package service

import (
	"context"
	"fmt"
	"strings"

	"jamaoxarid/backend/internal/authkit"
	"jamaoxarid/backend/internal/config"
	"jamaoxarid/backend/internal/models"
	"jamaoxarid/backend/internal/store"
)

type App struct {
	Cfg   config.Config
	Store *store.Store
}

func (a *App) RequestSMS(_ context.Context, phone string) error {
	_, err := authkit.NormalizeUZPhone(phone)
	return err
}

func (a *App) VerifySMS(ctx context.Context, phone, code, first, last string) (*models.User, string, bool, error) {
	phone, err := authkit.NormalizeUZPhone(phone)
	if err != nil {
		return nil, "", false, err
	}
	code = strings.TrimSpace(code)
	if code != a.Cfg.DefaultOTP {
		return nil, "", false, fmt.Errorf("kod noto‘g‘ri")
	}
	u, err := a.Store.UserByPhone(ctx, phone)
	if err != nil {
		return nil, "", false, err
	}
	if u == nil {
		if strings.TrimSpace(first) == "" || strings.TrimSpace(last) == "" {
			return nil, "", true, nil
		}
		u, err = a.Store.CreateCustomer(ctx, phone, strings.TrimSpace(first), strings.TrimSpace(last), nil)
		if err != nil {
			return nil, "", false, err
		}
	}
	if u.Role != "customer" {
		return nil, "", false, fmt.Errorf("bu raqam boshqa rol uchun band")
	}
	tok, err := authkit.SignToken(a.Cfg.JWTSecret, u.ID, u.Role)
	return u, tok, false, err
}

func (a *App) LoginPassword(ctx context.Context, phone, username, password, role string) (*models.User, string, error) {
	username = strings.ToLower(strings.TrimSpace(username))
	var u *models.User
	var err error
	if role == "admin" || username != "" {
		if username == "" {
			return nil, "", fmt.Errorf("username kerak")
		}
		u, err = a.Store.UserByUsername(ctx, username)
	} else {
		phone, err = authkit.NormalizeUZPhone(phone)
		if err != nil {
			return nil, "", err
		}
		u, err = a.Store.UserByPhone(ctx, phone)
	}
	if err != nil {
		return nil, "", err
	}
	if u == nil {
		return nil, "", fmt.Errorf("login yoki parol xato")
	}
	if role != "" && u.Role != role {
		return nil, "", fmt.Errorf("bu panel uchun ruxsat yo‘q")
	}
	hash, err := a.Store.PasswordHash(ctx, u.ID)
	if err != nil {
		return nil, "", err
	}
	if hash == "" || !authkit.CheckPassword(hash, password) {
		return nil, "", fmt.Errorf("login yoki parol xato")
	}
	tok, err := authkit.SignToken(a.Cfg.JWTSecret, u.ID, u.Role)
	return u, tok, err
}

func (a *App) TelegramAuth(ctx context.Context, phone string, telegramID *int64, first, last string) (*models.User, string, error) {
	phone, err := authkit.NormalizeUZPhone(phone)
	if err != nil {
		return nil, "", err
	}
	u, err := a.Store.UserByPhone(ctx, phone)
	if err != nil {
		return nil, "", err
	}
	if u == nil {
		u, err = a.Store.CreateCustomer(ctx, phone, first, last, telegramID)
		if err != nil {
			return nil, "", err
		}
	} else if u.Role != "customer" {
		return nil, "", fmt.Errorf("bu raqam boshqa rol uchun band")
	} else if telegramID != nil {
		_ = a.Store.LinkTelegram(ctx, u.ID, *telegramID)
		u, _ = a.Store.UserByID(ctx, u.ID)
	}
	tok, err := authkit.SignToken(a.Cfg.JWTSecret, u.ID, u.Role)
	return u, tok, err
}

func (a *App) Checkout(ctx context.Context, user *models.User, method string) (*models.Order, error) {
	if !user.ProfileCompleted || user.CityID == nil || user.MfyID == nil {
		return nil, fmt.Errorf("avval profil anketasini to‘ldiring")
	}
	if method != "pickup_mfy" && method != "home_delivery" {
		return nil, fmt.Errorf("yetkazish usuli noto‘g‘ri")
	}
	if method == "home_delivery" && (user.DeliveryLat == nil || user.DeliveryLng == nil) {
		return nil, fmt.Errorf("uyga yetkazish uchun xarita nuqtasi kerak")
	}
	cart, err := a.Store.Cart(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	if len(cart) == 0 {
		return nil, fmt.Errorf("savat bo‘sh")
	}

	tx, err := a.Store.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	fee := int64(0)
	if method == "home_delivery" {
		fee = a.Cfg.HomeDeliveryFeeUZS
	}
	o := &models.Order{
		UserID: user.ID, DeliveryMethod: method, DeliveryFeeUzs: fee,
		CityID: user.CityID, MfyID: user.MfyID,
		DeliveryLat: user.DeliveryLat, DeliveryLng: user.DeliveryLng, DeliveryAddress: user.DeliveryAddress,
	}
	if err := a.Store.CreateOrderTx(ctx, tx, o); err != nil {
		return nil, err
	}
	touched := map[string]struct{}{}
	for _, c := range cart {
		g, err := a.Store.LockGroupBuy(ctx, tx, c.GroupBuyID)
		if err != nil {
			return nil, err
		}
		if g == nil || g.Status != "open" {
			return nil, fmt.Errorf("%s yig‘imi endi ochiq emas", c.Title)
		}
		if err := a.Store.InsertItemTx(ctx, tx, o.ID, models.OrderItem{
			GroupBuyID: c.GroupBuyID, ProductID: g.ProductID, Title: g.Title, Quantity: c.Quantity,
			UnitPriceUzs: g.UnitPriceUzs, UnitLabel: g.UnitLabel,
		}); err != nil {
			return nil, err
		}
		touched[c.GroupBuyID] = struct{}{}
	}
	if err := a.Store.ClearCart(ctx, tx, user.ID); err != nil {
		return nil, err
	}
	for id := range touched {
		if _, _, _, err := a.Store.RecalcVolumeTx(ctx, tx, id); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return a.Store.Order(ctx, o.ID)
}

func (a *App) CancelOrder(ctx context.Context, userID, orderID string) error {
	o, err := a.Store.Order(ctx, orderID)
	if err != nil || o == nil {
		return fmt.Errorf("buyurtma topilmadi")
	}
	if o.UserID != userID {
		return fmt.Errorf("ruxsat yo‘q")
	}
	if o.Status != "collecting" {
		return fmt.Errorf("yig‘im yopilgach bekor qilib bo‘lmaydi")
	}
	ids := []string{}
	for _, it := range o.Items {
		ids = append(ids, it.GroupBuyID)
	}
	if err := a.Store.SetOrderStatus(ctx, orderID, "cancelled"); err != nil {
		return err
	}
	tx, err := a.Store.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for _, id := range ids {
		if _, err := a.Store.LockGroupBuy(ctx, tx, id); err != nil {
			return err
		}
		if _, _, _, err := a.Store.RecalcVolumeTx(ctx, tx, id); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (a *App) CloseCollection(ctx context.Context, id string) error {
	g, err := a.Store.GroupBuy(ctx, id)
	if err != nil || g == nil {
		return fmt.Errorf("yig‘im topilmadi")
	}
	if g.Status != "open" && g.Status != "closed" {
		return fmt.Errorf("bu yig‘imni yopib bo‘lmaydi")
	}
	if g.Status == "open" {
		if err := a.Store.SetGroupBuyStatus(ctx, id, "closed"); err != nil {
			return err
		}
	}
	oids, err := a.Store.CollectingOrdersForGroupBuy(ctx, id)
	if err != nil {
		return err
	}
	for _, oid := range oids {
		sts, err := a.Store.OrderGroupBuyStatuses(ctx, oid)
		if err != nil {
			return err
		}
		allClosed := true
		for _, st := range sts {
			if st == "open" {
				allClosed = false
				break
			}
		}
		if !allClosed {
			continue
		}
		o, err := a.Store.Order(ctx, oid)
		if err != nil || o == nil || o.Status != "collecting" {
			continue
		}
		if err := a.Store.SetOrderStatus(ctx, oid, "awaiting_courier"); err != nil {
			return err
		}
		_ = a.Store.Notify(ctx, o.UserID, "Yig‘im yopildi",
			fmt.Sprintf("%s yig‘imi yopildi. Kuryer qabul qilgach olish kodi chiqadi.", g.Title))
	}
	return nil
}

func (a *App) AcceptCollection(ctx context.Context, gbID string, mfyID *string) error {
	g, err := a.Store.GroupBuy(ctx, gbID)
	if err != nil || g == nil {
		return fmt.Errorf("yig‘im topilmadi")
	}
	if g.Status != "closed" && g.Status != "in_fulfillment" {
		return fmt.Errorf("avval admin yig‘imni yopishi kerak")
	}
	if g.Status == "closed" {
		if err := a.Store.SetGroupBuyStatus(ctx, gbID, "in_fulfillment"); err != nil {
			return err
		}
	}
	orders, err := a.Store.OrdersForGroupBuy(ctx, gbID)
	if err != nil {
		return err
	}
	scope := ""
	if mfyID != nil {
		scope = strings.TrimSpace(*mfyID)
	}
	matched := 0
	for _, o := range orders {
		if scope != "" && (o.MfyID == nil || *o.MfyID != scope) {
			continue
		}
		matched++
		if o.Status != "awaiting_courier" && o.Status != "collecting" && o.Status != "with_courier" {
			continue
		}
		sts, err := a.Store.OrderGroupBuyStatuses(ctx, o.ID)
		if err != nil {
			return err
		}
		allAccepted := true
		for _, st := range sts {
			if st != "in_fulfillment" && st != "completed" {
				allAccepted = false
				break
			}
		}
		if !allAccepted {
			continue
		}
		if o.Status == "with_courier" && o.PickupCode != "" {
			continue
		}
		code := o.PickupCode
		if code == "" {
			code, err = a.uniqueCode(ctx)
			if err != nil {
				return err
			}
			if err := a.Store.SetPickupCode(ctx, o.ID, code); err != nil {
				return err
			}
		}
		if err := a.Store.SetOrderStatus(ctx, o.ID, "with_courier"); err != nil {
			return err
		}
		_ = a.Store.Notify(ctx, o.UserID, "Kuryer qabul qildi",
			fmt.Sprintf("Olish kodingiz: %s. Shu kod orqali mahsulotni oling.", code))
	}
	if scope != "" && matched == 0 {
		return fmt.Errorf("bu MFYda qabul qiladigan buyurtma yo‘q")
	}
	return nil
}

func (a *App) CancelCollection(ctx context.Context, id string) error {
	g, err := a.Store.GroupBuy(ctx, id)
	if err != nil || g == nil {
		return fmt.Errorf("yig‘im topilmadi")
	}
	if g.Status != "open" && g.Status != "closed" {
		return fmt.Errorf("bu yig‘imni bekor qilib bo‘lmaydi")
	}
	oids, err := a.Store.CollectingOrdersForGroupBuy(ctx, id)
	if err != nil {
		return err
	}
	waiting, err := a.Store.OrdersForGroupBuy(ctx, id)
	if err != nil {
		return err
	}
	if err := a.Store.SetGroupBuyStatus(ctx, id, "cancelled"); err != nil {
		return err
	}
	seen := map[string]struct{}{}
	for _, oid := range oids {
		seen[oid] = struct{}{}
		o, _ := a.Store.Order(ctx, oid)
		if o != nil && o.Status == "collecting" {
			_ = a.Store.SetOrderStatus(ctx, oid, "cancelled")
			_ = a.Store.Notify(ctx, o.UserID, "Yig‘im bekor", g.Title+" yig‘imi bekor qilindi.")
		}
	}
	for _, o := range waiting {
		if _, ok := seen[o.ID]; ok {
			continue
		}
		if o.Status == "awaiting_courier" {
			_ = a.Store.SetOrderStatus(ctx, o.ID, "cancelled")
			_ = a.Store.Notify(ctx, o.UserID, "Yig‘im bekor", g.Title+" yig‘imi bekor qilindi.")
		}
	}
	return nil
}

func (a *App) EnsurePickupCode(ctx context.Context, userID, orderID string) (string, error) {
	o, err := a.Store.Order(ctx, orderID)
	if err != nil || o == nil || o.UserID != userID {
		return "", fmt.Errorf("buyurtma topilmadi")
	}
	if o.PickupCode != "" {
		return o.PickupCode, nil
	}
	switch o.Status {
	case "with_courier", "issued":
		return "", fmt.Errorf("kod hali yo‘q")
	case "collecting":
		return "", fmt.Errorf("yig‘im hali ochiq — admin yopgach kuryer qabul qiladi")
	case "awaiting_courier":
		return "", fmt.Errorf("kuryer qabul qilgach kod chiqadi")
	default:
		return "", fmt.Errorf("kod hali yo‘q")
	}
}

func (a *App) uniqueCode(ctx context.Context) (string, error) {
	for i := 0; i < 30; i++ {
		c, err := authkit.RandomDigits(4)
		if err != nil {
			return "", err
		}
		exists, err := a.Store.CodeExists(ctx, c)
		if err != nil {
			return "", err
		}
		if !exists {
			return c, nil
		}
	}
	return "", fmt.Errorf("kod yaratib bo‘lmadi")
}

func (a *App) IssueByCode(ctx context.Context, code string, mfyID *string) (*models.Order, error) {
	code = strings.TrimSpace(code)
	if len(code) != 4 {
		return nil, fmt.Errorf("kod 4 xonali bo‘lishi kerak")
	}
	o, err := a.Store.FindByPickupCode(ctx, code)
	if err != nil {
		return nil, err
	}
	if o == nil {
		return nil, fmt.Errorf("kod topilmadi")
	}
	if o.Status != "with_courier" {
		return nil, fmt.Errorf("bu kod bilan hali topshirib bo‘lmaydi")
	}
	if mfyID != nil && strings.TrimSpace(*mfyID) != "" {
		if o.MfyID == nil || *o.MfyID != strings.TrimSpace(*mfyID) {
			return nil, fmt.Errorf("bu kod boshqa MFYga tegishli")
		}
	}
	if err := a.Store.SetOrderStatus(ctx, o.ID, "issued"); err != nil {
		return nil, err
	}
	gids := map[string]struct{}{}
	for _, it := range o.Items {
		gids[it.GroupBuyID] = struct{}{}
	}
	for id := range gids {
		pend := 0
		_ = a.Store.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM orders o JOIN order_items oi ON oi.order_id=o.id
			WHERE oi.group_buy_id=$1 AND o.status IN ('collecting','awaiting_courier','with_courier')`, id).Scan(&pend)
		if pend == 0 {
			_ = a.Store.SetGroupBuyStatus(ctx, id, "completed")
		}
	}
	_ = a.Store.Notify(ctx, o.UserID, "Topshirildi", "Buyurtma muvaffaqiyatli berildi.")
	return a.Store.Order(ctx, o.ID)
}

func (a *App) ProcessDeadlines(ctx context.Context) {
	_ = a.Store.MaybeCompleteGroupBuys(ctx)
}
