package product

import (
	"bytes"
	"encoding/json"
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
	maxImageBytes = 5 << 20 // 5MB
	maxImages     = 5
	minImages     = 1
)

type Module struct {
	repo      *Repository
	uploadDir string
}

func New(db *pgxpool.Pool, uploadDir string) *Module {
	if uploadDir == "" {
		uploadDir = "uploads"
	}
	_ = os.MkdirAll(filepath.Join(uploadDir, "products"), 0o755)
	return &Module{
		repo:      NewRepository(db),
		uploadDir: uploadDir,
	}
}

func (m *Module) Name() string { return "Product" }

func (m *Module) Register(rg *gin.RouterGroup) {
	g := rg.Group("/products")
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
	c.JSON(http.StatusOK, gin.H{"module": "product", "status": "ok"})
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
		items = []ProductListItem{}
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

func validateDelta(raw json.RawMessage) error {
	if len(raw) == 0 {
		return fmt.Errorf("description required")
	}
	var probe struct {
		Ops []json.RawMessage `json:"ops"`
	}
	if err := json.Unmarshal(raw, &probe); err != nil {
		return fmt.Errorf("description must be delta json")
	}
	if len(probe.Ops) == 0 {
		return fmt.Errorf("description empty")
	}
	return nil
}

func (m *Module) parseUpsert(c *gin.Context) (*Product, error) {
	var req UpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		return nil, fmt.Errorf("invalid body")
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, fmt.Errorf("name required")
	}
	catID, err := uuid.Parse(strings.TrimSpace(req.CategoryID))
	if err != nil {
		return nil, fmt.Errorf("invalid category_id")
	}
	subID, err := uuid.Parse(strings.TrimSpace(req.SubcategoryID))
	if err != nil {
		return nil, fmt.Errorf("invalid subcategory_id")
	}
	unit := strings.TrimSpace(req.Unit)
	if unit != "dona" && unit != "litr" && unit != "kg" {
		return nil, fmt.Errorf("unit must be dona, litr or kg")
	}
	if req.UnitSize <= 0 {
		return nil, fmt.Errorf("unit_size must be > 0")
	}
	if req.Stock < 0 {
		return nil, fmt.Errorf("stock must be >= 0")
	}
	if req.Price < 0 {
		return nil, fmt.Errorf("price must be >= 0")
	}
	if err := validateDelta(req.Description); err != nil {
		return nil, err
	}
	imgs := make([]string, 0, len(req.Images))
	for _, u := range req.Images {
		u = strings.TrimSpace(u)
		if u == "" {
			continue
		}
		imgs = append(imgs, u)
	}
	if len(imgs) < minImages || len(imgs) > maxImages {
		return nil, fmt.Errorf("images: min %d, max %d", minImages, maxImages)
	}
	status := normalizeStatus(req.Status)
	if status != "active" && status != "inactive" {
		return nil, fmt.Errorf("invalid status")
	}

	ok, err := m.repo.SubcategoryBelongs(c.Request.Context(), catID, subID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("subcategory does not belong to category")
	}

	return &Product{
		CategoryID:    catID,
		SubcategoryID: subID,
		Name:          name,
		Description:   req.Description,
		Unit:          unit,
		UnitSize:      req.UnitSize,
		Stock:         req.Stock,
		Price:         req.Price,
		Images:        imgs,
		Status:        status,
	}, nil
}

func (m *Module) Create(c *gin.Context) {
	item, err := m.parseUpsert(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := m.repo.Create(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	full, err := m.repo.Get(c.Request.Context(), item.ID)
	if err != nil {
		c.JSON(http.StatusCreated, item)
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
	item, err := m.parseUpsert(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updated, err := m.repo.Update(c.Request.Context(), id, item)
	if err != nil {
		if IsNoRows(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
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
	c.JSON(http.StatusOK, item)
}

func (m *Module) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := m.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": dbx.PublicError(err, "Mahsulotni o‘chirib bo‘lmadi")})
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
	dir := filepath.Join(m.uploadDir, "products")
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

	url := "/uploads/products/" + name
	c.JSON(http.StatusCreated, gin.H{"url": url})
}
