package order

import (
	"errors"
	"net/http"
	"strings"

	"birgaarzon/backend/internal/config"
	"birgaarzon/backend/modules/admin"
	"birgaarzon/backend/modules/kuryer"
	usermod "birgaarzon/backend/modules/user"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	ctxUserID   = "order_user_id"
	ctxUser     = "order_user"
	ctxAdminID  = "order_admin_id"
	ctxKuryerID = "order_kuryer_id"
)

type Module struct {
	db      *pgxpool.Pool
	cfg     *config.Config
	service *Service
	repo    *Repository
	users   *usermod.Service
}

func New(db *pgxpool.Pool, cfg *config.Config, settings MinOrderReader) *Module {
	repo := NewRepository(db)
	userRepo := usermod.NewRepository(db)
	return &Module{
		db:      db,
		cfg:     cfg,
		repo:    repo,
		service: NewService(repo, cfg, settings),
		users:   usermod.NewService(userRepo, cfg, nil),
	}
}

func (m *Module) Name() string { return "Order" }

func (m *Module) Service() *Service { return m.service }

func (m *Module) Repository() *Repository { return m.repo }

func (m *Module) Users() *usermod.Service { return m.users }

func (m *Module) Register(rg *gin.RouterGroup) {
	// User
	ug := rg.Group("/orders")
	ug.Use(m.userAuth())
	{
		ug.POST("", m.Create)
		ug.GET("", m.ListMine)
		ug.GET("/:id", m.GetMine)
	}

	// Admin
	ag := rg.Group("/admin/orders")
	ag.Use(m.adminAuth())
	{
		ag.GET("/stats", m.AdminStats)
		ag.GET("", m.AdminList)
		ag.GET("/:id", m.AdminGet)
		ag.PATCH("/:id/assign", m.AdminAssign)
		ag.PATCH("/:id/auto-assign", m.AdminAutoAssign)
		ag.PATCH("/:id/unassign", m.AdminUnassign)
		ag.PATCH("/:id/status", m.AdminStatus)
	}

	// Kuryer (under /kuryer/orders — registered separately to share kuryer auth path)
	kg := rg.Group("/kuryer/orders")
	kg.Use(m.kuryerAuth())
	{
		kg.GET("", m.KuryerList)
		kg.GET("/history", m.KuryerHistory)
		kg.GET("/:id", m.KuryerGet)
		kg.POST("/:id/deliver", m.KuryerDeliver)
	}
}

func (m *Module) Create(c *gin.Context) {
	u := currentUser(c)
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	o, err := m.service.Create(c.Request.Context(), u, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	o.HideDeliveryCodeUntilPaid()
	c.JSON(http.StatusCreated, o)
}

func (m *Module) ListMine(c *gin.Context) {
	id := currentUserID(c)
	items, err := m.service.ListMine(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if items == nil {
		items = []Order{}
	}
	for i := range items {
		items[i].HideDeliveryCodeUntilPaid()
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (m *Module) GetMine(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	o, err := m.service.GetMine(c.Request.Context(), currentUserID(c), oid)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	o.HideDeliveryCodeUntilPaid()
	c.JSON(http.StatusOK, o)
}

func (m *Module) AdminStats(c *gin.Context) {
	s, err := m.service.Stats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}

func (m *Module) AdminList(c *gin.Context) {
	items, err := m.service.ListAdmin(c.Request.Context(), c.Query("status"), c.Query("q"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if items == nil {
		items = []Order{}
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (m *Module) AdminGet(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	o, err := m.service.Get(c.Request.Context(), oid)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, o)
}

func (m *Module) AdminAssign(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req AssignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	kid, err := uuid.Parse(strings.TrimSpace(req.KuryerID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kuryer_id noto‘g‘ri"})
		return
	}
	o, err := m.service.Assign(c.Request.Context(), oid, kid)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, o)
}

func (m *Module) AdminAutoAssign(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	o, err := m.service.AutoAssign(c.Request.Context(), oid)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, o)
}

func (m *Module) AdminUnassign(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	o, err := m.service.Unassign(c.Request.Context(), oid)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, o)
}

func (m *Module) AdminStatus(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req StatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	o, err := m.service.SetStatus(c.Request.Context(), oid, strings.TrimSpace(req.Status))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, o)
}

func (m *Module) KuryerList(c *gin.Context) {
	items, err := m.service.ListKuryer(c.Request.Context(), currentKuryerID(c), false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if items == nil {
		items = []Order{}
	}
	for i := range items {
		items[i].DeliveryCode = ""
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (m *Module) KuryerHistory(c *gin.Context) {
	items, err := m.service.ListKuryer(c.Request.Context(), currentKuryerID(c), true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if items == nil {
		items = []Order{}
	}
	for i := range items {
		items[i].DeliveryCode = ""
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (m *Module) KuryerGet(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	o, err := m.service.Get(c.Request.Context(), oid)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	kid := currentKuryerID(c)
	if o.KuryerID == nil || *o.KuryerID != kid {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	// Hide delivery code from courier until they need to ask user — still show for confirm UX? 
	// User has the code; courier enters what user tells them. Don't expose stored code in list.
	o.DeliveryCode = ""
	c.JSON(http.StatusOK, o)
}

func (m *Module) KuryerDeliver(c *gin.Context) {
	oid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req DeliverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	o, err := m.service.Deliver(c.Request.Context(), currentKuryerID(c), oid, req.Code)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	o.DeliveryCode = ""
	c.JSON(http.StatusOK, o)
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
		c.Set(ctxUserID, id)
		c.Set(ctxUser, u)
		c.Next()
	}
}

func (m *Module) adminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := bearer(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		claims := &admin.Claims{}
		parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
			return []byte(m.cfg.JWTSecret), nil
		})
		if err != nil || !parsed.Valid || claims.AdminID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		id, err := uuid.Parse(claims.AdminID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Set(ctxAdminID, id)
		c.Next()
	}
}

func (m *Module) kuryerAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := bearer(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		claims := &kuryer.Claims{}
		parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
			return []byte(m.cfg.JWTSecret), nil
		})
		if err != nil || !parsed.Valid || claims.Role != "kuryer" || claims.KuryerID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		id, err := uuid.Parse(claims.KuryerID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Set(ctxKuryerID, id)
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

func currentUser(c *gin.Context) *usermod.User {
	v, _ := c.Get(ctxUser)
	u, _ := v.(*usermod.User)
	return u
}

func currentUserID(c *gin.Context) uuid.UUID {
	v, _ := c.Get(ctxUserID)
	id, _ := v.(uuid.UUID)
	return id
}

func currentKuryerID(c *gin.Context) uuid.UUID {
	v, _ := c.Get(ctxKuryerID)
	id, _ := v.(uuid.UUID)
	return id
}
