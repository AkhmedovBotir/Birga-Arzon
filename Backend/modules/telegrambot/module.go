package telegrambot

import (
	"context"
	"net/http"

	"birgaarzon/backend/modules/settings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Module struct {
	service   *Service
	adminAuth gin.HandlerFunc
}

func New(db *pgxpool.Pool, settingsRepo *settings.Repository, adminAuth gin.HandlerFunc) *Module {
	svc := NewService(db, settingsRepo)
	svc.Start(context.Background())

	return &Module{
		service:   svc,
		adminAuth: adminAuth,
	}
}

func (m *Module) Name() string {
	return "TelegramBot"
}

func (m *Module) Service() *Service {
	return m.service
}

func (m *Module) Register(rg *gin.RouterGroup) {
	// Webhook endpoint for Telegram updates (agar webhook rejimida ishlatilsa)
	rg.POST("/bot/webhook", m.Webhook)

	// Admin API endpointlari
	ag := rg.Group("/admin/bot")
	ag.Use(m.adminAuth)
	{
		ag.GET("/status", m.GetStatus)
		ag.POST("/test", m.TestToken)
		ag.POST("/sync-commands", m.SyncCommands)
	}
}

func (m *Module) Webhook(c *gin.Context) {
	if err := m.service.HandleWebhookUpdate(c.Request.Body); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "ignored", "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (m *Module) GetStatus(c *gin.Context) {
	status := m.service.Status()
	c.JSON(http.StatusOK, status)
}

func (m *Module) TestToken(c *gin.Context) {
	var req struct {
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Noto‘g‘ri so‘rov"})
		return
	}

	user, err := m.service.TestToken(req.Token)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"ok":    false,
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":         true,
		"bot_id":     user.ID,
		"username":   user.Username,
		"first_name": user.FirstName,
	})
}

func (m *Module) SyncCommands(c *gin.Context) {
	if err := m.service.SyncCommands(c.Request.Context()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "Komandalar muvaffaqiyatli sinxronlandi (/start, /help, /app)",
	})
}
