package kuryer

import (
	"errors"
	"net/http"

	"birgaarzon/backend/internal/config"
	"birgaarzon/backend/internal/dbx"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Module struct {
	db      *pgxpool.Pool
	service *Service
}

func New(db *pgxpool.Pool, cfg *config.Config) *Module {
	repo := NewRepository(db)
	return &Module{
		db:      db,
		service: NewService(repo, cfg),
	}
}

func (m *Module) Name() string { return "Kuryer" }

func (m *Module) Register(rg *gin.RouterGroup) {
	// Admin CRUD
	g := rg.Group("/kuryers")
	{
		g.GET("/health", m.Health)
		g.GET("/stats", m.Stats)
		g.GET("", m.List)
		g.POST("", m.Create)
		g.GET("/:id", m.Get)
		g.PUT("/:id", m.Update)
		g.PATCH("/:id/status", m.SetStatus)
		g.DELETE("/:id", m.Delete)
	}

	// Kuryer app auth
	app := rg.Group("/kuryer")
	{
		app.POST("/login", m.Login)
		auth := app.Group("")
		auth.Use(m.AuthRequired())
		{
			auth.GET("/me", m.Me)
			auth.GET("/dashboard", m.Dashboard)
		}
	}
}

func (m *Module) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"module": "kuryer", "status": "ok"})
}

func (m *Module) Stats(c *gin.Context) {
	s, err := m.service.Stats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}

func (m *Module) List(c *gin.Context) {
	items, err := m.service.List(c.Request.Context(), c.Query("q"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]PublicKuryer, 0, len(items))
	for i := range items {
		out = append(out, items[i].Public())
	}
	c.JSON(http.StatusOK, gin.H{"items": out})
}

func (m *Module) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	k, err := m.service.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, k.Public())
}

func (m *Module) Create(c *gin.Context) {
	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	k, err := m.service.Create(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, k.Public())
}

func (m *Module) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	k, err := m.service.Update(c.Request.Context(), id, req)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, k.Public())
}

func (m *Module) SetStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req StatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	k, err := m.service.SetActive(c.Request.Context(), id, req.IsActive)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, k.Public())
}

func (m *Module) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := m.service.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": dbx.PublicError(err, "Kuryerni o‘chirib bo‘lmadi")})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (m *Module) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	res, err := m.service.Login(c.Request.Context(), req.Phone, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (m *Module) Me(c *gin.Context) {
	k := currentKuryer(c)
	if k == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	c.JSON(http.StatusOK, k.Public())
}

func (m *Module) Dashboard(c *gin.Context) {
	id, _ := c.Get(ctxKuryerID)
	uid, _ := id.(uuid.UUID)
	dash, err := m.service.Dashboard(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, dash)
}