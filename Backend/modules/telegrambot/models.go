package telegrambot

// Telegram User
type User struct {
	ID           int64  `json:"id"`
	IsBot        bool   `json:"is_bot"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name,omitempty"`
	Username     string `json:"username,omitempty"`
	LanguageCode string `json:"language_code,omitempty"`
}

// Telegram Chat
type Chat struct {
	ID        int64  `json:"id"`
	Type      string `json:"type"`
	Title     string `json:"title,omitempty"`
	Username  string `json:"username,omitempty"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
}

// Telegram Message
type Message struct {
	MessageID int64  `json:"message_id"`
	From      *User  `json:"from,omitempty"`
	Chat      Chat   `json:"chat"`
	Date      int64  `json:"date"`
	Text      string `json:"text,omitempty"`
}

// Telegram CallbackQuery
type CallbackQuery struct {
	ID      string   `json:"id"`
	From    User     `json:"from"`
	Message *Message `json:"message,omitempty"`
	Data    string   `json:"data,omitempty"`
}

// Telegram Update
type Update struct {
	UpdateID      int64          `json:"update_id"`
	Message       *Message       `json:"message,omitempty"`
	CallbackQuery *CallbackQuery `json:"callback_query,omitempty"`
}

// Telegram WebAppInfo
type WebAppInfo struct {
	URL string `json:"url"`
}

// Telegram InlineKeyboardButton
type InlineKeyboardButton struct {
	Text         string      `json:"text"`
	URL          string      `json:"url,omitempty"`
	CallbackData string      `json:"callback_data,omitempty"`
	WebApp       *WebAppInfo `json:"web_app,omitempty"`
}

// Telegram InlineKeyboardMarkup
type InlineKeyboardMarkup struct {
	InlineKeyboard [][]InlineKeyboardButton `json:"inline_keyboard"`
}

// Telegram KeyboardButton
type KeyboardButton struct {
	Text   string      `json:"text"`
	WebApp *WebAppInfo `json:"web_app,omitempty"`
}

// Telegram ReplyKeyboardMarkup
type ReplyKeyboardMarkup struct {
	Keyboard       [][]KeyboardButton `json:"keyboard"`
	ResizeKeyboard bool               `json:"resize_keyboard,omitempty"`
	OneTimeKeyboard bool              `json:"one_time_keyboard,omitempty"`
}

// Telegram BotCommand
type BotCommand struct {
	Command     string `json:"command"`
	Description string `json:"description"`
}

// Telegram MenuButton
type MenuButton struct {
	Type   string      `json:"type"`
	Text   string      `json:"text,omitempty"`
	WebApp *WebAppInfo `json:"web_app,omitempty"`
}

// Telegram SendMessage Request
type SendMessageRequest struct {
	ChatID      int64       `json:"chat_id"`
	Text        string      `json:"text"`
	ParseMode   string      `json:"parse_mode,omitempty"`
	ReplyMarkup interface{} `json:"reply_markup,omitempty"`
}

// Telegram AnswerCallbackQuery Request
type AnswerCallbackQueryRequest struct {
	CallbackQueryID string `json:"callback_query_id"`
	Text            string `json:"text,omitempty"`
}

// Telegram API Generic Response
type APIResponse[T any] struct {
	OK          bool   `json:"ok"`
	Result      T      `json:"result,omitempty"`
	Description string `json:"description,omitempty"`
	ErrorCode   int    `json:"error_code,omitempty"`
}

// Bot Status DTO for Admin UI
type BotStatusResponse struct {
	Active    bool   `json:"active"`
	BotID     int64  `json:"bot_id,omitempty"`
	Username  string `json:"username,omitempty"`
	FirstName string `json:"first_name,omitempty"`
	WebappURL string `json:"webapp_url"`
	Error     string `json:"error,omitempty"`
}
