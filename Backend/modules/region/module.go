package region

import (
	"net/http"
	"strings"

	"birgaarzon/backend/internal/dbx"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Module struct {
	repo *Repository
}

func New(db *pgxpool.Pool) *Module {
	return &Module{repo: NewRepository(db)}
}

func (m *Module) Name() string { return "Region" }

func (m *Module) Register(rg *gin.RouterGroup) {
	g := rg.Group("/regions")
	{
		g.GET("/health", m.Health)
		g.GET("/stats", m.Stats)
		g.GET("/tree", m.Tree)
		g.GET("/viloyatlar", m.ListViloyats)
		g.GET("/:id/children", m.Children)
		g.POST("", m.Create)
		g.PUT("/:id", m.Update)
		g.PATCH("/:id/status", m.UpdateStatus)
		g.DELETE("/:id", m.Delete)
	}
}

func (m *Module) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"module": "region", "status": "ok"})
}

func (m *Module) Stats(c *gin.Context) {
	stats, err := m.repo.Stats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (m *Module) Tree(c *gin.Context) {
	tree, err := m.repo.TreeViloyatTuman(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": tree})
}

func (m *Module) ListViloyats(c *gin.Context) {
	list, err := m.repo.ListViloyats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list})
}

func (m *Module) Children(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	typ := c.Query("type")
	list, err := m.repo.Children(c.Request.Context(), id, typ)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list})
}

func (m *Module) Create(c *gin.Context) {
	var req CreateRegionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}
	typ := strings.TrimSpace(req.Type)
	if typ != TypeViloyat && typ != TypeTuman {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type must be viloyat or tuman"})
		return
	}
	if typ == TypeTuman && (req.ParentID == nil || *req.ParentID == uuid.Nil) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parent_id required for tuman"})
		return
	}
	if typ == TypeViloyat {
		req.ParentID = nil
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "active"
	}
	if status != "active" && status != "inactive" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status must be active or inactive"})
		return
	}

	item := &Region{
		Name:     name,
		Code:     strings.TrimSpace(req.Code),
		Type:     typ,
		ParentID: req.ParentID,
		Status:   status,
	}
	if err := m.repo.CreateManual(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (m *Module) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req UpdateRegionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "active"
	}
	item, err := m.repo.Update(c.Request.Context(), id, name, strings.TrimSpace(req.Code), status)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (m *Module) UpdateStatus(c *gin.Context) {
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
	status := strings.TrimSpace(req.Status)
	if status != "active" && status != "inactive" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status must be active or inactive"})
		return
	}
	item, err := m.repo.UpdateStatus(c.Request.Context(), id, status)
	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (m *Module) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := m.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": dbx.PublicError(err, "Hududni o‘chirib bo‘lmadi")})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
