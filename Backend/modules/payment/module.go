package payment

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"birgaarzon/backend/internal/atmos"
	"birgaarzon/backend/internal/config"
	"birgaarzon/backend/modules/order"
	usermod "birgaarzon/backend/modules/user"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type FeeProvider interface {
	DeliveryFee(ctx context.Context) (float64, error)
}

type Module struct {
	cfg       *config.Config
	orders    *order.Service
	repo      *order.Repository
	users     *usermod.Service
	atmos     *atmos.Client
	fees      FeeProvider
	adminAuth gin.HandlerFunc
}

func New(
	cfg *config.Config,
	orderSvc *order.Service,
	orderRepo *order.Repository,
	users *usermod.Service,
	fees FeeProvider,
	adminAuth gin.HandlerFunc,
) *Module {
	return &Module{
		cfg:       cfg,
		orders:    orderSvc,
		repo:      orderRepo,
		users:     users,
		atmos:     atmos.NewClient(cfg),
		fees:      fees,
		adminAuth: adminAuth,
	}
}

func (m *Module) Name() string { return "Payment" }

func (m *Module) Register(rg *gin.RouterGroup) {
	rg.POST("/payments/atmos/callback", m.AtmosCallback)

	ug := rg.Group("/orders")
	ug.Use(m.userAuth())
	{
		ug.GET("/:id/payment", m.GetPayment)
		ug.POST("/:id/payment/sync", m.UserSyncPayment)
		ug.POST("/:id/payment/card", m.PayCard)
		ug.POST("/:id/payment/cash", m.PayCash)
	}

	ag := rg.Group("/admin/payments")
	ag.Use(m.adminAuth)
	{
		ag.GET("/stats", m.AdminStats)
		ag.GET("", m.AdminList)
		ag.POST("/:id/sync", m.AdminSync)
		ag.POST("/:id/confirm", m.AdminConfirm)
	}
}

func (m *Module) AdminStats(c *gin.Context) {
	s, err := m.repo.PaymentStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}

func (m *Module) AdminList(c *gin.Context) {
	items, err := m.repo.ListPayments(
		c.Request.Context(),
		strings.TrimSpace(c.Query("status")),
		strings.TrimSpace(c.Query("method")),
		c.Query("q"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if items == nil {
		items = []order.PaymentListItem{}
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

type paymentView struct {
	OrderID       string  `json:"order_id"`
	Status        string  `json:"order_status"`
	PaymentStatus string  `json:"payment_status"`
	PaymentMethod string  `json:"payment_method"`
	GoodsAmount   float64 `json:"goods_amount"`
	DeliveryFee   float64 `json:"delivery_fee"`
	PayableAmount float64 `json:"payable_amount"`
	NeedsPayment  bool    `json:"needs_payment"`
	AtmosEnabled  bool    `json:"atmos_enabled"`
	ItemsCount    int     `json:"items_count"`
}

func (m *Module) resolveFee(ctx context.Context, o *order.Order) float64 {
	if o.DeliveryFee > 0 {
		return o.DeliveryFee
	}
	if m.fees != nil {
		if f, err := m.fees.DeliveryFee(ctx); err == nil {
			return f
		}
	}
	return 0
}

func (m *Module) GetPayment(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	o, err := m.orders.GetMine(c.Request.Context(), currentUserID(c), oid)
	if err != nil {
		if errors.Is(err, order.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Auto-sync if payment is pending
	if o.PaymentStatus == order.PaymentPending {
		if m.trySyncOrderPayment(c.Request.Context(), o.ID) {
			if updated, err := m.orders.GetMine(c.Request.Context(), currentUserID(c), oid); err == nil {
				o = updated
			}
		}
	}

	fee := m.resolveFee(c.Request.Context(), o)
	c.JSON(http.StatusOK, paymentView{
		OrderID:       o.ID.String(),
		Status:        o.Status,
		PaymentStatus: o.PaymentStatus,
		PaymentMethod: o.PaymentMethod,
		GoodsAmount:   o.TotalAmount,
		DeliveryFee:   fee,
		PayableAmount: o.TotalAmount + fee,
		NeedsPayment:  o.NeedsPayment,
		AtmosEnabled:  m.atmos.Enabled(),
		ItemsCount:    len(o.Items),
	})
}

func (m *Module) UserSyncPayment(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	o, err := m.orders.GetMine(c.Request.Context(), currentUserID(c), oid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	synced := m.trySyncOrderPayment(c.Request.Context(), o.ID)
	updated, _ := m.orders.GetMine(c.Request.Context(), currentUserID(c), oid)
	if updated != nil {
		o = updated
	}
	c.JSON(http.StatusOK, gin.H{
		"synced":         synced,
		"payment_status": o.PaymentStatus,
		"needs_payment":  o.NeedsPayment,
	})
}

func (m *Module) PayCard(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	o, err := m.orders.GetMine(c.Request.Context(), currentUserID(c), oid)
	if err != nil {
		if errors.Is(err, order.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if o.PaymentStatus == order.PaymentPaid || o.PaymentStatus == order.PaymentCOD {
		c.JSON(http.StatusBadRequest, gin.H{"error": "buyurtma allaqachon to‘langan"})
		return
	}
	if o.Status != order.StatusReady && o.Status != order.StatusAssigned {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to‘lov yig‘im yopilib kuryerga o‘tgach ochiladi"})
		return
	}
	if !m.atmos.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Atmos to‘lov hozircha sozlanmagan"})
		return
	}

	fee := m.resolveFee(c.Request.Context(), o)
	payable := o.TotalAmount + fee
	tiyin := atmos.ToTiyin(payable)
	if tiyin < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to‘lov summasi noto‘g‘ri"})
		return
	}

	requestID := fmt.Sprintf("ba-%s-%d", strings.ReplaceAll(o.ID.String(), "-", "")[:12], tiyin)
	storeID, _ := strconv.Atoi(m.cfg.AtmosStoreID)
	lang := strings.TrimSpace(c.Query("lang"))
	if lang == "" {
		lang = "uz"
	}
	successURL := fmt.Sprintf("%s/buyurtmalar/%s/tolov?paid=1", m.cfg.FrontendURL, o.ID.String())

	inv, err := m.atmos.CreateInvoice(c.Request.Context(), atmos.InvoiceCreateRequest{
		RequestID:  requestID,
		StoreID:    storeID,
		Account:    o.ID.String(),
		Amount:     tiyin,
		SuccessURL: successURL,
		Lang:       lang,
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	paymentID := inv.GetPaymentID()
	invoice := inv.GetInvoice()
	if invoice == "" {
		invoice = paymentID
	}
	if invoice == "" {
		invoice = requestID
	}
	if paymentID == "" {
		paymentID = invoice
	}

	if err := m.repo.CreatePaymentRecord(
		c.Request.Context(), o.ID, requestID, paymentID, inv.Token, payable, tiyin, inv.URL,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := m.repo.UpdatePaymentCard(c.Request.Context(), o.ID, paymentID, invoice, fee); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"checkout_url": inv.URL,
		"payment_id":   paymentID,
		"token":        inv.Token,
		"amount":       payable,
		"amount_tiyin": tiyin,
	})
}

func (m *Module) PayCash(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	o, err := m.orders.GetMine(c.Request.Context(), currentUserID(c), oid)
	if err != nil {
		if errors.Is(err, order.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if o.PaymentStatus == order.PaymentPaid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "buyurtma allaqachon to‘langan"})
		return
	}
	if o.Status != order.StatusReady && o.Status != order.StatusAssigned {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to‘lov yig‘im yopilib kuryerga o‘tgach ochiladi"})
		return
	}
	fee := m.resolveFee(c.Request.Context(), o)
	if err := m.repo.MarkCOD(c.Request.Context(), o.ID, fee); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	updated, err := m.orders.GetMine(c.Request.Context(), currentUserID(c), oid)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "cod"})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (m *Module) AtmosCallback(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": 0, "message": "bad body"})
		return
	}
	fmt.Printf("[AtmosCallback] received: %s\n", string(body))

	var payload atmos.CallbackPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		fmt.Printf("[AtmosCallback] unmarshal error: %v (body: %s)\n", err, string(body))
		c.JSON(http.StatusBadRequest, gin.H{"status": 0, "message": "invalid json"})
		return
	}
	if m.cfg.AtmosAPIKey != "" && !m.atmos.VerifyCallback(payload) {
		fmt.Printf("[AtmosCallback] sign verify failed for body: %s\n", string(body))
		c.JSON(http.StatusForbidden, gin.H{"status": 0, "message": "invalid sign"})
		return
	}

	account := payload.AccountString()
	invoice := payload.InvoiceString()
	txID := payload.TransactionIDString()
	reqID := payload.RequestIDString()
	token := payload.TokenString()

	orderID, err := m.repo.FindOrderByAny(c.Request.Context(), account, invoice, txID, reqID, token)
	if err != nil {
		fmt.Printf("[AtmosCallback] order not found for identifiers (acc=%s, inv=%s, tx=%s, req=%s, token=%s)\n", account, invoice, txID, reqID, token)
		// Acknowledge to avoid endless retries on unknown invoices
		c.JSON(http.StatusOK, gin.H{"status": 1, "message": "Успешно"})
		return
	}

	_ = m.repo.SaveCallback(c.Request.Context(), orderID, txID, body)
	_ = m.repo.MarkPaid(c.Request.Context(), orderID, txID, invoice)
	fmt.Printf("[AtmosCallback] order %s successfully marked PAID (tx=%s, inv=%s)\n", orderID, txID, invoice)

	c.JSON(http.StatusOK, gin.H{"status": 1, "message": "Успешно"})
}

func (m *Module) trySyncOrderPayment(ctx context.Context, orderID uuid.UUID) bool {
	if !m.atmos.Enabled() {
		return false
	}
	rec, err := m.repo.GetLatestPaymentForOrder(ctx, orderID)
	if err != nil || rec == nil {
		return false
	}
	if rec.Token == "" && rec.PaymentID == "" {
		return false
	}
	res, err := m.atmos.GetInvoice(ctx, rec.Token, rec.PaymentID)
	if err != nil {
		fmt.Printf("[AtmosSync] GetInvoice error for order %s: %v\n", orderID, err)
		return false
	}
	if res.Paid {
		tx := res.TransactionID
		if tx == "" {
			tx = rec.PaymentID
		}
		inv := res.Invoice
		_ = m.repo.MarkPaid(ctx, orderID, tx, inv)
		if len(res.Raw) > 0 {
			_ = m.repo.SaveCallback(ctx, orderID, tx, res.Raw)
		}
		fmt.Printf("[AtmosSync] order %s marked PAID via Atmos sync (tx=%s, inv=%s)\n", orderID, tx, inv)
		return true
	}
	return false
}

func (m *Module) AdminSync(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	synced := m.trySyncOrderPayment(c.Request.Context(), oid)
	c.JSON(http.StatusOK, gin.H{"synced": synced})
}

func (m *Module) AdminConfirm(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var input struct {
		PaymentID string `json:"payment_id"`
		Invoice   string `json:"invoice"`
	}
	_ = c.ShouldBindJSON(&input)
	if err := m.repo.MarkPaid(c.Request.Context(), oid, input.PaymentID, input.Invoice); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "paid"})
}

func (m *Module) userAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := bearer(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		claims, err := m.users.ParseToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		id, err := uuid.Parse(claims.UserID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		u, err := m.users.Me(c.Request.Context(), id)
		if err != nil || u.IsBlocked {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Set("pay_user_id", id)
		c.Next()
	}
}

func bearer(c *gin.Context) (string, error) {
	h := c.GetHeader("Authorization")
	if h == "" || !strings.HasPrefix(h, "Bearer ") {
		return "", errors.New("missing")
	}
	return strings.TrimSpace(strings.TrimPrefix(h, "Bearer ")), nil
}

func currentUserID(c *gin.Context) uuid.UUID {
	v, _ := c.Get("pay_user_id")
	id, _ := v.(uuid.UUID)
	return id
}
