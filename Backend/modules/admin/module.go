package admin

import (
	"errors"
	"net/http"

	"birgaarzon/backend/internal/config"
	usermod "birgaarzon/backend/modules/user"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Module struct {
	db       *pgxpool.Pool
	service  *Service
	userRepo *usermod.Repository
}

func New(db *pgxpool.Pool, cfg *config.Config) *Module {
	repo := NewRepository(db)
	return &Module{
		db:       db,
		service:  NewService(repo, cfg),
		userRepo: usermod.NewRepository(db),
	}
}

func (m *Module) Name() string { return "Admin" }

func (m *Module) Service() *Service { return m.service }

func (m *Module) Register(rg *gin.RouterGroup) {
	g := rg.Group("/admin")
	{
		g.GET("/health", m.Health)
		g.GET("/ping", m.Ping)
		g.POST("/login", m.Login)

		auth := g.Group("")
		auth.Use(m.AuthRequired())
		{
			auth.GET("/me", m.Me)
			auth.GET("/admins", m.ListAdmins)

			auth.GET("/users", m.ListUsers)
			auth.POST("/users", m.CreateUser)
			auth.PUT("/users/:id", m.UpdateUser)
			auth.PATCH("/users/:id/block", m.SetUserBlocked)
			auth.DELETE("/users/:id", m.DeleteUser)

			general := auth.Group("")
			general.Use(m.GeneralRequired())
			{
				general.POST("/admins", m.CreateAdmin)
				general.PUT("/admins/:id", m.UpdateAdmin)
				general.DELETE("/admins/:id", m.DeleteAdmin)
			}
		}
	}
}

// Health godoc
// @Summary      Admin module health
// @Tags         admin
// @Produce      json
// @Success      200  {object}  map[string]string
// @Router       /api/v1/admin/health [get]
func (m *Module) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"module":  "admin",
		"status":  "ok",
		"message": "Admin module ready",
	})
}

// Ping godoc
// @Summary      Admin DB ping
// @Tags         admin
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      503  {object}  map[string]string
// @Router       /api/v1/admin/ping [get]
func (m *Module) Ping(c *gin.Context) {
	if err := m.db.Ping(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"module": "admin", "db": "down", "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"module": "admin", "db": "up"})
}

// Login godoc
// @Summary      Admin login
// @Tags         admin
// @Accept       json
// @Produce      json
// @Param        body  body  LoginRequest  true  "credentials"
// @Success      200   {object}  LoginResponse
// @Failure      401   {object}  map[string]string
// @Router       /api/v1/admin/login [post]
func (m *Module) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	res, err := m.service.Login(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

// Me godoc
// @Summary      Current admin
// @Tags         admin
// @Produce      json
// @Success      200  {object}  PublicAdmin
// @Router       /api/v1/admin/me [get]
func (m *Module) Me(c *gin.Context) {
	a := currentAdmin(c)
	if a == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	c.JSON(http.StatusOK, a.Public())
}

// ListAdmins godoc
// @Summary      List admins
// @Tags         admin
// @Produce      json
// @Success      200  {array}  PublicAdmin
// @Router       /api/v1/admin/admins [get]
func (m *Module) ListAdmins(c *gin.Context) {
	list, err := m.service.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list})
}

// CreateAdmin godoc
// @Summary      Create admin (general only, role=admin)
// @Tags         admin
// @Accept       json
// @Produce      json
// @Param        body  body  CreateAdminRequest  true  "admin"
// @Success      201   {object}  PublicAdmin
// @Router       /api/v1/admin/admins [post]
func (m *Module) CreateAdmin(c *gin.Context) {
	creator := currentAdmin(c)
	if creator == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	var req CreateAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	a, err := m.service.CreateAdminByGeneral(c.Request.Context(), creator, req)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, ErrUsernameTaken) {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, a.Public())
}

// UpdateAdmin godoc
// @Summary      Update admin (general only)
// @Tags         admin
// @Accept       json
// @Produce      json
// @Param        id    path  string  true  "admin id"
// @Param        body  body  UpdateAdminRequest  true  "admin"
// @Success      200   {object}  PublicAdmin
// @Router       /api/v1/admin/admins/{id} [put]
func (m *Module) UpdateAdmin(c *gin.Context) {
	actor := currentAdmin(c)
	if actor == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req UpdateAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	a, err := m.service.UpdateAdmin(c.Request.Context(), actor, id, req)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, ErrNotFound) {
			status = http.StatusNotFound
		} else if errors.Is(err, ErrUsernameTaken) {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, a.Public())
}

// DeleteAdmin godoc
// @Summary      Delete admin (general only, role=admin)
// @Tags         admin
// @Produce      json
// @Param        id  path  string  true  "admin id"
// @Success      200  {object}  map[string]string
// @Router       /api/v1/admin/admins/{id} [delete]
func (m *Module) DeleteAdmin(c *gin.Context) {
	actor := currentAdmin(c)
	if actor == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := m.service.DeleteAdmin(c.Request.Context(), actor, id); err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, ErrNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
