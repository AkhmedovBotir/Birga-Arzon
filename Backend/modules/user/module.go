package user

import (
	"errors"
	"net/http"

	"birgaarzon/backend/internal/config"
	"birgaarzon/backend/internal/sms"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Module struct {
	db      *pgxpool.Pool
	service *Service
}

func New(db *pgxpool.Pool, cfg *config.Config) *Module {
	repo := NewRepository(db)
	smsClient := sms.NewEskiz(cfg.EskizEmail, cfg.EskizPassword, cfg.EskizFrom)
	return &Module{
		db:      db,
		service: NewService(repo, cfg, smsClient),
	}
}

func (m *Module) Name() string { return "User" }

func (m *Module) Register(rg *gin.RouterGroup) {
	g := rg.Group("/user")
	{
		g.GET("/health", m.Health)
		g.GET("/ping", m.Ping)

		auth := g.Group("/auth")
		{
			auth.POST("/send-otp", m.SendOTP)
			auth.POST("/verify-otp", m.VerifyOTP)
		}

		secured := g.Group("")
		secured.Use(m.AuthRequired())
		{
			secured.GET("/me", m.Me)
			secured.POST("/profile", m.CompleteProfile)
		}
	}
}

func (m *Module) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"module":  "user",
		"status":  "ok",
		"message": "User module ready",
	})
}

func (m *Module) Ping(c *gin.Context) {
	if err := m.db.Ping(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"module": "user", "db": "down", "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"module": "user", "db": "up"})
}

func (m *Module) SendOTP(c *gin.Context) {
	var req SendOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	err := m.service.SendOTP(c.Request.Context(), req.Phone)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidPhone):
			c.JSON(http.StatusBadRequest, gin.H{"error": "telefon raqam noto‘g‘ri"})
		case errors.Is(err, ErrBlocked):
			c.JSON(http.StatusForbidden, gin.H{"error": "hisobingiz bloklangan"})
		case errors.Is(err, ErrResendTooSoon):
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Kodni birozdan keyin qayta so‘rang"})
		case errors.Is(err, ErrSMSNotConfigured):
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "SMS xizmati sozlanmagan"})
		default:
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":  "sent",
		"message": "SMS kod yuborildi",
	})
}

func (m *Module) VerifyOTP(c *gin.Context) {
	var req VerifyOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	res, err := m.service.VerifyOTP(c.Request.Context(), req.Phone, req.Code)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidPhone):
			c.JSON(http.StatusBadRequest, gin.H{"error": "telefon raqam noto‘g‘ri"})
		case errors.Is(err, ErrTooManyTries):
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "juda ko‘p urinish. Yangi kod oling"})
		case errors.Is(err, ErrInvalidOTP):
			c.JSON(http.StatusUnauthorized, gin.H{"error": "kod noto‘g‘ri yoki muddati tugagan"})
		case errors.Is(err, ErrBlocked):
			c.JSON(http.StatusForbidden, gin.H{"error": "hisobingiz bloklangan"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, res)
}

func (m *Module) Me(c *gin.Context) {
	u := currentUser(c)
	c.JSON(http.StatusOK, u)
}

func (m *Module) CompleteProfile(c *gin.Context) {
	var req CompleteProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	u, err := m.service.CompleteProfile(c.Request.Context(), currentUserID(c), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, u)
}
