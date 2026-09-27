package telegrambot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"birgaarzon/backend/modules/settings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	db           *pgxpool.Pool
	settingsRepo *settings.Repository
	httpClient   *http.Client

	mu            sync.RWMutex
	activeToken   string
	webappURL     string
	botUser       *User
	lastErr       string
	runningCancel context.CancelFunc
}

func NewService(db *pgxpool.Pool, settingsRepo *settings.Repository) *Service {
	return &Service{
		db:           db,
		settingsRepo: settingsRepo,
		httpClient: &http.Client{
			Timeout: 35 * time.Second,
		},
		webappURL: "https://birgaarzon.uz",
	}
}

// Start bot watcher and polling loop in the background
func (s *Service) Start(ctx context.Context) {
	go s.supervisorLoop(ctx)
}

func (s *Service) supervisorLoop(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Initial check
	s.checkAndReload(ctx)

	for {
		select {
		case <-ctx.Done():
			s.stopCurrentWorker()
			return
		case <-ticker.C:
			s.checkAndReload(ctx)
		}
	}
}

func (s *Service) checkAndReload(ctx context.Context) {
	token, err := s.settingsRepo.TelegramBotToken(ctx)
	if err != nil {
		s.setLastError(fmt.Sprintf("Failed to read token: %v", err))
		return
	}
	token = strings.TrimSpace(token)

	webURL, _ := s.settingsRepo.TelegramWebappURL(ctx)
	if strings.TrimSpace(webURL) == "" {
		webURL = "https://birgaarzon.uz"
	}

	s.mu.Lock()
	tokenChanged := s.activeToken != token
	urlChanged := s.webappURL != webURL
	s.webappURL = webURL
	s.mu.Unlock()

	if !tokenChanged && !urlChanged {
		return
	}

	if token == "" {
		s.stopCurrentWorker()
		s.mu.Lock()
		s.activeToken = ""
		s.botUser = nil
		s.lastErr = "Bot token kiritilmagan"
		s.mu.Unlock()
		return
	}

	// Verify new token
	botUser, err := s.getMe(token)
	if err != nil {
		s.stopCurrentWorker()
		s.mu.Lock()
		s.activeToken = token
		s.botUser = nil
		s.lastErr = fmt.Sprintf("Token noto‘g‘ri: %v", err)
		s.mu.Unlock()
		fmt.Printf("[TelegramBot] Error connecting with token: %v\n", err)
		return
	}

	s.stopCurrentWorker()

	s.mu.Lock()
	s.activeToken = token
	s.botUser = botUser
	s.lastErr = ""
	workerCtx, cancel := context.WithCancel(ctx)
	s.runningCancel = cancel
	s.mu.Unlock()

	fmt.Printf("[TelegramBot] Connected as @%s (ID: %d, Name: %s)\n", botUser.Username, botUser.ID, botUser.FirstName)

	// Set official bot commands: /start, /help, /app
	if err := s.setBotCommands(token); err != nil {
		fmt.Printf("[TelegramBot] Warning: failed to register bot commands: %v\n", err)
	} else {
		fmt.Printf("[TelegramBot] Registered commands: /start, /help, /app\n")
	}

	// Set chat menu button to open Mini App
	if err := s.setChatMenuButton(token, webURL); err != nil {
		fmt.Printf("[TelegramBot] Warning: failed to set chat menu button: %v\n", err)
	}

	// Start long polling worker
	go s.pollingWorker(workerCtx, token, webURL)
}

func (s *Service) stopCurrentWorker() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.runningCancel != nil {
		s.runningCancel()
		s.runningCancel = nil
	}
}

func (s *Service) setLastError(errStr string) {
	s.mu.Lock()
	s.lastErr = errStr
	s.mu.Unlock()
}

func (s *Service) pollingWorker(ctx context.Context, token string, webappURL string) {
	var offset int64 = 0

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		updates, err := s.fetchUpdates(ctx, token, offset, 25)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			time.Sleep(3 * time.Second)
			continue
		}

		for _, update := range updates {
			if update.UpdateID >= offset {
				offset = update.UpdateID + 1
			}
			s.handleUpdate(token, webappURL, update)
		}
	}
}

func (s *Service) handleUpdate(token string, webappURL string, update Update) {
	if update.Message != nil {
		s.handleMessage(token, webappURL, update.Message)
		return
	}
	if update.CallbackQuery != nil {
		s.handleCallback(token, webappURL, update.CallbackQuery)
		return
	}
}

func (s *Service) handleMessage(token string, webappURL string, msg *Message) {
	if msg.Chat.ID == 0 {
		return
	}

	text := strings.TrimSpace(msg.Text)
	cmd := strings.ToLower(text)

	// Telegram commands might be "/command@BotUsername"
	if idx := strings.Index(cmd, "@"); idx != -1 {
		cmd = cmd[:idx]
	}

	switch cmd {
	case "/start", "start", "boshlash", "bosh menyu", "asosiy menyu", "menyu", "orqaga", "orqaga qaytish", "🔙 orqaga", "🔙 asosiy menyu", "🔙 asosiy menyuga qaytish":
		s.sendStartMessage(token, webappURL, msg)
	case "/help", "help", "yordam", "qo'llanma", "qollanma", "yo'riqnoma", "info", "ma'lumot", "malumot":
		s.sendHelpMessage(token, webappURL, msg.Chat.ID)
	case "/app", "app", "ilova", "mini ilova", "mini app", "xarid":
		s.sendAppMessage(token, webappURL, msg.Chat.ID)
	default:
		if strings.Contains(cmd, "orqaga") || strings.Contains(cmd, "menyu") || strings.Contains(cmd, "bosh") {
			s.sendStartMessage(token, webappURL, msg)
		} else if strings.Contains(cmd, "yordam") || strings.Contains(cmd, "help") {
			s.sendHelpMessage(token, webappURL, msg.Chat.ID)
		} else if strings.Contains(cmd, "ilova") || strings.Contains(cmd, "app") || strings.Contains(cmd, "xarid") {
			s.sendAppMessage(token, webappURL, msg.Chat.ID)
		} else {
			s.sendDefaultMessage(token, webappURL, msg.Chat.ID)
		}
	}
}

func (s *Service) handleCallback(token string, webappURL string, cb *CallbackQuery) {
	_ = s.answerCallback(token, cb.ID)

	chatID := cb.From.ID
	if cb.Message != nil && cb.Message.Chat.ID != 0 {
		chatID = cb.Message.Chat.ID
	}

	switch cb.Data {
	case "cmd_help":
		s.sendHelpMessage(token, webappURL, chatID)
	case "cmd_app":
		s.sendAppMessage(token, webappURL, chatID)
	case "cmd_start", "back_to_menu", "back":
		s.sendStartMessage(token, webappURL, &Message{Chat: Chat{ID: chatID}, From: &cb.From})
	default:
		s.sendStartMessage(token, webappURL, &Message{Chat: Chat{ID: chatID}, From: &cb.From})
	}
}

func (s *Service) sendStartMessage(token string, webappURL string, msg *Message) {
	name := "Xaridor"
	if msg.From != nil && msg.From.FirstName != "" {
		name = msg.From.FirstName
	}

	text := fmt.Sprintf(
		"👋 *Assalomu alaykum, %s!*\n\n"+
			"🛒 *BirgaArzon* — ommaviy xaridlar va eng arzon ulgurji narxlar platformasining rasmiy botiga xush kelibsiz!\n\n"+
			"Bu yerda siz do‘stlaringiz va qo‘shnilaringiz bilan birgalikda yig‘ilib xarid qilishingiz hamda mahsulotlarni to‘g‘ridan-to‘g‘ri ulgurji narxda sotib olishingiz mumkin.\n\n"+
			"🚀 *Xaridni boshlash uchun quyidagi tugmani bosing:*",
		escapeMarkdown(name),
	)

	req := SendMessageRequest{
		ChatID:    msg.Chat.ID,
		Text:      text,
		ParseMode: "Markdown",
		ReplyMarkup: InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{
					{
						Text:   "🛒 BirgaArzon'ni ochish (Mini App)",
						WebApp: &WebAppInfo{URL: webappURL},
					},
				},
				{
					{
						Text:         "ℹ️ Yordam va Qo‘llanma",
						CallbackData: "cmd_help",
					},
					{
						Text:         "🚀 Mini Ilova",
						CallbackData: "cmd_app",
					},
				},
				{
					{
						Text: "🌐 Rasmiy sayt",
						URL:  webappURL,
					},
				},
			},
		},
	}
	_ = s.sendMessage(token, req)
}

func (s *Service) sendHelpMessage(token string, webappURL string, chatID int64) {
	text := "ℹ️ *BirgaArzon — Yordam va Qo‘llanma*\n\n" +
		"*BirgaArzon nima?*\n" +
		"BirgaArzon — bu ommaviy birgalikda xarid qilish platformasi. Xaridorlar birgalikda birlashganda, ulgurji eng arzon narxlarda mahsulot olish imkoniyati yaratiladi.\n\n" +
		"📌 *Asosiy buyruqlar:*\n" +
		"• /start — Asosiy menyu va ishga tushirish\n" +
		"• /help — Yordam va yo‘riqnoma\n" +
		"• /app — Mini ilovani ochish\n\n" +
		"🛍 *Qanday buyurtma beriladi?*\n" +
		"1. /app buyrug‘ini yuboring yoki quyidagi *Mini Ilovani ochish* tugmasini bosing.\n" +
		"2. Kerakli ommaviy yig‘im yoki mahsulotni tanlang.\n" +
		"3. Xarid guruhiga qo‘shiling va to‘lovni amalga oshiring.\n" +
		"4. Kuryer buyurtmangizni belgilangan manzilga yetkazib beradi.\n\n" +
		"📞 *Bog‘lanish va qo‘llab-quvvatlash:*\n" +
		"• Telefon: +998 90 123 45 67\n" +
		"• E-mail: info@birgaarzon.uz\n" +
		"• Sayt: " + webappURL

	req := SendMessageRequest{
		ChatID:    chatID,
		Text:      text,
		ParseMode: "Markdown",
		ReplyMarkup: InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{
					{
						Text:   "🛒 Mini Ilovani ochish",
						WebApp: &WebAppInfo{URL: webappURL},
					},
				},
				{
					{
						Text:         "🔙 Asosiy menyuga qaytish",
						CallbackData: "cmd_start",
					},
				},
				{
					{
						Text: "🌐 Saytga o‘tish",
						URL:  webappURL,
					},
					{
						Text:         "🚀 Mini Ilova haqida",
						CallbackData: "cmd_app",
					},
				},
			},
		},
	}
	_ = s.sendMessage(token, req)
}

func (s *Service) sendAppMessage(token string, webappURL string, chatID int64) {
	text := "🚀 *BirgaArzon Mini Ilovasi*\n\n" +
		"Barcha mahsulotlar, qizg‘in ommaviy yig‘imlar va eng arzon narxlarni ko‘rish uchun quyidagi tugmani bosing:"

	req := SendMessageRequest{
		ChatID:    chatID,
		Text:      text,
		ParseMode: "Markdown",
		ReplyMarkup: InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{
					{
						Text:   "🛒 BirgaArzon'ni ochish (Mini App)",
						WebApp: &WebAppInfo{URL: webappURL},
					},
				},
				{
					{
						Text:         "🔙 Asosiy menyuga qaytish",
						CallbackData: "cmd_start",
					},
					{
						Text:         "ℹ️ Yordam",
						CallbackData: "cmd_help",
					},
				},
			},
		},
	}
	_ = s.sendMessage(token, req)
}

func (s *Service) sendDefaultMessage(token string, webappURL string, chatID int64) {
	text := "Assalomu alaykum! *BirgaArzon* orqali eng arzon narxlarda xarid qilish uchun mini ilovani oching yoki quyidagi tugmalardan foydalaning:\n\n" +
		"• /start — Asosiy menyu va ishga tushirish\n" +
		"• /help — Yordam va ma'lumot\n" +
		"• /app — Mini ilovani ochish"

	req := SendMessageRequest{
		ChatID:    chatID,
		Text:      text,
		ParseMode: "Markdown",
		ReplyMarkup: InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{
					{
						Text:   "🛒 BirgaArzon'ni ochish (Mini App)",
						WebApp: &WebAppInfo{URL: webappURL},
					},
				},
				{
					{
						Text:         "🔙 Asosiy menyu",
						CallbackData: "cmd_start",
					},
					{
						Text:         "ℹ️ Yordam",
						CallbackData: "cmd_help",
					},
				},
			},
		},
	}
	_ = s.sendMessage(token, req)
}

// Telegram API wrappers

func (s *Service) getMe(token string) (*User, error) {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/getMe", token)
	resp, err := s.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var res APIResponse[User]
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}
	if !res.OK {
		return nil, fmt.Errorf("telegram error (%d): %s", res.ErrorCode, res.Description)
	}
	return &res.Result, nil
}

func (s *Service) setBotCommands(token string) error {
	commands := []BotCommand{
		{Command: "start", Description: "BirgaArzon'ni ishga tushirish"},
		{Command: "help", Description: "Yordam"},
		{Command: "app", Description: "Mini ilovani ochish"},
	}

	body, err := json.Marshal(map[string]interface{}{
		"commands": commands,
	})
	if err != nil {
		return err
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/setMyCommands", token)
	resp, err := s.httpClient.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var res APIResponse[bool]
	_ = json.NewDecoder(resp.Body).Decode(&res)
	if !res.OK {
		return fmt.Errorf("setMyCommands failed: %s", res.Description)
	}
	return nil
}

func (s *Service) setChatMenuButton(token string, webappURL string) error {
	reqBody := map[string]interface{}{
		"menu_button": MenuButton{
			Type: "web_app",
			Text: "🛒 BirgaArzon",
			WebApp: &WebAppInfo{
				URL: webappURL,
			},
		},
	}
	body, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/setChatMenuButton", token)
	resp, err := s.httpClient.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var res APIResponse[bool]
	_ = json.NewDecoder(resp.Body).Decode(&res)
	if !res.OK {
		return fmt.Errorf("setChatMenuButton failed: %s", res.Description)
	}
	return nil
}

func (s *Service) sendMessage(token string, req SendMessageRequest) error {
	body, err := json.Marshal(req)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	resp, err := s.httpClient.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var res APIResponse[Message]
	_ = json.NewDecoder(resp.Body).Decode(&res)
	if !res.OK {
		return fmt.Errorf("sendMessage failed: %s", res.Description)
	}
	return nil
}

func (s *Service) answerCallback(token string, callbackID string) error {
	req := AnswerCallbackQueryRequest{CallbackQueryID: callbackID}
	body, _ := json.Marshal(req)
	url := fmt.Sprintf("https://api.telegram.org/bot%s/answerCallbackQuery", token)
	resp, err := s.httpClient.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (s *Service) fetchUpdates(ctx context.Context, token string, offset int64, timeout int) ([]Update, error) {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/getUpdates?offset=%d&timeout=%d", token, offset, timeout)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var res APIResponse[[]Update]
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}
	if !res.OK {
		return nil, fmt.Errorf("getUpdates error (%d): %s", res.ErrorCode, res.Description)
	}
	return res.Result, nil
}

// Public API for Admin UI

func (s *Service) Status() BotStatusResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	active := s.botUser != nil && s.activeToken != ""
	res := BotStatusResponse{
		Active:    active,
		WebappURL: s.webappURL,
		Error:     s.lastErr,
	}
	if s.botUser != nil {
		res.BotID = s.botUser.ID
		res.Username = s.botUser.Username
		res.FirstName = s.botUser.FirstName
	}
	return res
}

func (s *Service) TestToken(token string) (*User, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, fmt.Errorf("token bo‘sh bo‘lishi mumkin emas")
	}
	return s.getMe(token)
}

func (s *Service) SyncCommands(ctx context.Context) error {
	s.mu.RLock()
	token := s.activeToken
	webURL := s.webappURL
	s.mu.RUnlock()

	if token == "" {
		return fmt.Errorf("bot token sozlanmagan")
	}

	if err := s.setBotCommands(token); err != nil {
		return err
	}
	if err := s.setChatMenuButton(token, webURL); err != nil {
		return err
	}
	return nil
}

// Handle incoming Webhook update
func (s *Service) HandleWebhookUpdate(body io.Reader) error {
	var update Update
	if err := json.NewDecoder(body).Decode(&update); err != nil {
		return err
	}

	s.mu.RLock()
	token := s.activeToken
	webURL := s.webappURL
	s.mu.RUnlock()

	if token == "" {
		return fmt.Errorf("bot not active")
	}

	s.handleUpdate(token, webURL, update)
	return nil
}

func escapeMarkdown(s string) string {
	s = strings.ReplaceAll(s, "_", "\\_")
	s = strings.ReplaceAll(s, "*", "\\*")
	s = strings.ReplaceAll(s, "`", "\\`")
	s = strings.ReplaceAll(s, "[", "\\[")
	return s
}
