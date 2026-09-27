package yigim

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"birgaarzon/backend/internal/dbx"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	maxImageBytes = 5 << 20
	maxImages     = 5
	minImages     = 1
)

type StatusHook func(ctx context.Context, id uuid.UUID, status string)

type Module struct {
	repo      *Repository
	uploadDir string
	onStatus  StatusHook
}

func New(db *pgxpool.Pool, uploadDir string, onStatus StatusHook) *Module {
	if uploadDir == "" {
		uploadDir = "uploads"
	}
	_ = os.MkdirAll(filepath.Join(uploadDir, "yigims"), 0o755)
	return &Module{repo: NewRepository(db), uploadDir: uploadDir, onStatus: onStatus}
}

func (m *Module) Name() string { return "Yigim" }

func (m *Module) Register(rg *gin.RouterGroup) {
	g := rg.Group("/yigims")
	{
		g.GET("/health", m.Health)
		g.GET("/stats", m.Stats)
		g.POST("/upload", m.Upload)
		g.GET("", m.List)
		g.POST("", m.Create)
		g.GET("/:id", m.Get)
		g.PUT("/:id", m.Update)
		g.PATCH("/:id/status", m.UpdateStatus)
		g.DELETE("/:id", m.Delete)
	}
}

func (m *Module) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"module": "yigim", "status": "ok"})
}

func (m *Module) Stats(c *gin.Context) {
	stats, err := m.repo.Stats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (m *Module) List(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	items, err := m.repo.List(c.Request.Context(), q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if items == nil {
		items = []Yigim{}
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (m *Module) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	item, err := m.repo.Get(c.Request.Context(), id)
	if err != nil {
		if IsNoRows(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func normalizeStatus(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "active"
	}
	return s
}

func (m *Module) parseUpsert(c *gin.Context) (*Yigim, []YigimItem, error) {
	var req UpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		return nil, nil, fmt.Errorf("invalid body")
	}
	typ := strings.TrimSpace(req.Type)
	if typ != "single" && typ != "combo" {
		return nil, nil, fmt.Errorf("type must be single or combo")
	}
	if req.TargetQty < 1 {
		return nil, nil, fmt.Errorf("target_qty must be >= 1")
	}
	currentQty := 0
	if req.CurrentQty != nil {
		if *req.CurrentQty < 0 {
			return nil, nil, fmt.Errorf("current_qty must be >= 0")
		}
		currentQty = *req.CurrentQty
	}
	imgs := make([]string, 0, len(req.Images))
	for _, u := range req.Images {
		u = strings.TrimSpace(u)
		if u != "" {
			imgs = append(imgs, u)
		}
	}
	if len(imgs) < minImages || len(imgs) > maxImages {
		return nil, nil, fmt.Errorf("images: min %d, max %d", minImages, maxImages)
	}
	status := normalizeStatus(req.Status)
	if status != "active" && status != "inactive" {
		return nil, nil, fmt.Errorf("invalid status")
	}

	y := &Yigim{
		Type:       typ,
		TargetQty:  req.TargetQty,
		CurrentQty: currentQty,
		Images:     imgs,
		Status:     status,
		Items:      []YigimItem{},
	}

	var items []YigimItem

	if typ == "single" {
		pid, err := uuid.Parse(strings.TrimSpace(req.ProductID))
		if err != nil {
			return nil, nil, fmt.Errorf("product_id required")
		}
		ok, err := m.repo.ProductExists(c.Request.Context(), pid)
		if err != nil {
			return nil, nil, err
		}
		if !ok {
			return nil, nil, fmt.Errorf("product not found")
		}
		y.ProductID = &pid
		y.Name = nil
	} else {
		name := strings.TrimSpace(req.Name)
		if name == "" {
			return nil, nil, fmt.Errorf("combo name required")
		}
		y.Name = &name
		y.ProductID = nil

		seen := map[uuid.UUID]struct{}{}
		for _, it := range req.Items {
			pid, err := uuid.Parse(strings.TrimSpace(it.ProductID))
			if err != nil {
				return nil, nil, fmt.Errorf("invalid item product_id")
			}
			if it.Qty < 1 {
				return nil, nil, fmt.Errorf("item qty must be >= 1")
			}
			if _, dup := seen[pid]; dup {
				return nil, nil, fmt.Errorf("duplicate product in combo")
			}
			seen[pid] = struct{}{}
			ok, err := m.repo.ProductExists(c.Request.Context(), pid)
			if err != nil {
				return nil, nil, err
			}
			if !ok {
				return nil, nil, fmt.Errorf("product not found")
			}
			items = append(items, YigimItem{ProductID: pid, Qty: it.Qty})
		}
		if len(items) < 2 {
			return nil, nil, fmt.Errorf("combo needs at least 2 products")
		}
	}

	return y, items, nil
}

func (m *Module) Create(c *gin.Context) {
	y, items, err := m.parseUpsert(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := m.repo.Create(c.Request.Context(), y, items); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	full, err := m.repo.Get(c.Request.Context(), y.ID)
	if err != nil {
		c.JSON(http.StatusCreated, y)
		return
	}
	c.JSON(http.StatusCreated, full)
}

func (m *Module) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	y, items, err := m.parseUpsert(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := m.repo.Update(c.Request.Context(), id, y, items); err != nil {
		if IsNoRows(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	full, err := m.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusOK, y)
		return
	}
	c.JSON(http.StatusOK, full)
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
	status := normalizeStatus(req.Status)
	if status != "active" && status != "inactive" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}
	item, err := m.repo.UpdateStatus(c.Request.Context(), id, status)
	if err != nil {
		if IsNoRows(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if status == "inactive" && m.onStatus != nil {
		m.onStatus(c.Request.Context(), id, status)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": dbx.PublicError(err, "Yig‘imni o‘chirib bo‘lmadi")})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (m *Module) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
		return
	}
	if file.Size > maxImageBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "max 5MB"})
		return
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "only jpg/png/webp/gif"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot open file"})
		return
	}
	defer src.Close()

	head := make([]byte, 512)
	n, _ := io.ReadFull(src, head)
	ctype := http.DetectContentType(head[:n])
	if !strings.HasPrefix(ctype, "image/") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is not an image"})
		return
	}

	name := uuid.New().String() + ext
	dir := filepath.Join(m.uploadDir, "yigims")
	_ = os.MkdirAll(dir, 0o755)
	dstPath := filepath.Join(dir, name)
	dst, err := os.Create(dstPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot save file"})
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, io.MultiReader(bytes.NewReader(head[:n]), src)); err != nil {
		_ = os.Remove(dstPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "write failed"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"url": "/uploads/yigims/" + name})
}
