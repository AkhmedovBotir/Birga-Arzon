package server

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"birgaarzon/backend/internal/config"
	"birgaarzon/backend/modules/admin"
	"birgaarzon/backend/modules/category"
	"birgaarzon/backend/modules/kuryer"
	"birgaarzon/backend/modules/order"
	"birgaarzon/backend/modules/payment"
	"birgaarzon/backend/modules/product"
	"birgaarzon/backend/modules/region"
	"birgaarzon/backend/modules/settings"
	"birgaarzon/backend/modules/user"
	"birgaarzon/backend/modules/yigim"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

type Module interface {
	Name() string
	Register(rg *gin.RouterGroup)
}

type Server struct {
	cfg     *config.Config
	engine  *gin.Engine
	modules []Module
	payment *payment.Module
}

func New(cfg *config.Config, db *pgxpool.Pool) *Server {
	gin.SetMode(gin.ReleaseMode)

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())
	r.Use(requestLogger())

	adminMod := admin.New(db, cfg)
	settingsMod := settings.New(db, adminMod.AuthRequired())
	orderMod := order.New(db, cfg, settingsMod)
	paymentMod := payment.New(
		cfg,
		orderMod.Service(),
		orderMod.Repository(),
		orderMod.Users(),
		settingsMod,
		adminMod.AuthRequired(),
	)
	s := &Server{
		cfg:    cfg,
		engine: r,
		modules: []Module{
			adminMod,
			kuryer.New(db, cfg),
			user.New(db, cfg),
			region.New(db),
			category.New(db, "uploads"),
			product.New(db, "uploads"),
			yigim.New(db, "uploads", func(ctx context.Context, id uuid.UUID, status string) {
				_ = orderMod.Service().OnYigimClosed(ctx, id)
			}),
			settingsMod,
			orderMod,
			paymentMod,
		},
		payment: paymentMod,
	}

	s.routes()
	return s
}

func (s *Server) Engine() *gin.Engine { return s.engine }

func (s *Server) ModuleNames() []string {
	names := make([]string, 0, len(s.modules))
	for _, m := range s.modules {
		names = append(names, m.Name())
	}
	return names
}

func (s *Server) routes() {
	s.engine.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"app":    s.cfg.AppName,
			"time":   time.Now().UTC(),
		})
	})

	s.engine.Static("/uploads", "uploads")

	s.engine.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	s.engine.MaxMultipartMemory = 8 << 20 // 8 MiB

	api := s.engine.Group("/api/v1")
	for _, m := range s.modules {
		m.Register(api)
	}

	if s.payment != nil {
		s.engine.POST("/payments/atmos/callback", s.payment.AtmosCallback)
		s.engine.POST("/api/payments/atmos/callback", s.payment.AtmosCallback)
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func requestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		latency := time.Since(start)
		status := c.Writer.Status()
		color := "\033[32m"
		if status >= 500 {
			color = "\033[31m"
		} else if status >= 400 {
			color = "\033[33m"
		}
		const reset = "\033[0m"
		const dim = "\033[2m"
		const bold = "\033[1m"

		fmt.Printf(
			"%s%s%s %s%s%s%s %s %s%d%s %s%s%s\n",
			dim, start.Format("15:04:05"), reset,
			bold, color, c.Request.Method, reset,
			c.Request.URL.Path,
			color, status, reset,
			dim, latency, reset,
		)
	}
}
