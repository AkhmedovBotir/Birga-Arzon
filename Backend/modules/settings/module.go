package settings

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Module struct {
	repo      *Repository
	adminAuth gin.HandlerFunc
}

func New(db *pgxpool.Pool, adminAuth gin.HandlerFunc) *Module {
	return &Module{
		repo:      NewRepository(db),
		adminAuth: adminAuth,
	}
}

func (m *Module) Name() string { return "Settings" }

func (m *Module) Repository() *Repository { return m.repo }

func (m *Module) MinOrderAmount(ctx context.Context) (float64, error) {
	return m.repo.MinOrderAmount(ctx)
}

func (m *Module) DeliveryFee(ctx context.Context) (float64, error) {
	return m.repo.DeliveryFee(ctx)
}

func (m *Module) Register(rg *gin.RouterGroup) {
	rg.GET("/settings", m.GetPublic)

	ag := rg.Group("/admin/settings")
	ag.Use(m.adminAuth)
	{
		ag.GET("", m.GetAdmin)
		ag.PUT("", m.Update)
	}
}

func (m *Module) GetPublic(c *gin.Context) {
	s, err := m.repo.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"min_order_amount": s.MinOrderAmount,
		"delivery_fee":     s.DeliveryFee,
	})
}

func (m *Module) GetAdmin(c *gin.Context) {
	s, err := m.repo.Get(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}

func (m *Module) Update(c *gin.Context) {
	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if req.MinOrderAmount == nil && req.DeliveryFee == nil && req.TelegramBotToken == nil && req.TelegramWebappURL == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields"})
		return
	}
	if req.MinOrderAmount != nil && *req.MinOrderAmount < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "min_order_amount must be >= 0"})
		return
	}
	if req.DeliveryFee != nil && *req.DeliveryFee < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "delivery_fee must be >= 0"})
		return
	}
	s, err := m.repo.Update(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}
