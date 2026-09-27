package category

import (
	"bytes"
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

const maxImageBytes = 5 << 20 // 5MB

type Module struct {
	repo      *Repository
	uploadDir string
}

func New(db *pgxpool.Pool, uploadDir string) *Module {
	if uploadDir == "" {
		uploadDir = "uploads"
	}
	_ = os.MkdirAll(filepath.Join(uploadDir, "categories"), 0o755)
	return &Module{repo: NewRepository(db), uploadDir: uploadDir}
}

func (m *Module) Name() string { return "Category" }

func (m *Module) Register(rg *gin.RouterGroup) {
	g := rg.Group("/categories")
	{
		g.GET("/health", m.Health)
		g.GET("/stats", m.Stats)
		g.GET("/tree", m.Tree)
		g.POST("/upload", m.Upload)
		g.PATCH("/reorder", m.ReorderCategories)
		g.POST("", m.CreateCategory)
		g.PUT("/:id", m.UpdateCategory)
		g.PATCH("/:id/status", m.UpdateCategoryStatus)
		g.DELETE("/:id", m.DeleteCategory)
		g.POST("/:id/subcategories", m.CreateSubcategory)
	}

	sg := rg.Group("/subcategories")
	{
		sg.PATCH("/reorder", m.ReorderSubcategories)
		sg.PUT("/:id", m.UpdateSubcategory)
		sg.PATCH("/:id/status", m.UpdateSubcategoryStatus)
		sg.DELETE("/:id", m.DeleteSubcategory)
	}
}

func (m *Module) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"module": "category", "status": "ok"})
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
	tree, err := m.repo.Tree(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": tree})
}

func normalizeStatus(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "active"
	}
	return s
}

func (m *Module) CreateCategory(c *gin.Context) {
	var req CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}
	icon := strings.TrimSpace(req.Icon)
	if icon == "" {
		icon = "tag"
	}
	image := strings.TrimSpace(req.Image)
	status := normalizeStatus(req.Status)
	if status != "active" && status != "inactive" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}
	item := &Category{Name: name, Icon: icon, Image: image, Status: status}
	if err := m.repo.CreateCategory(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (m *Module) UpdateCategory(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}
	icon := strings.TrimSpace(req.Icon)
	if icon == "" {
		icon = "tag"
	}
	image := strings.TrimSpace(req.Image)
	status := normalizeStatus(req.Status)
	item, err := m.repo.UpdateCategory(c.Request.Context(), id, name, icon, image, status)
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

func (m *Module) UpdateCategoryStatus(c *gin.Context) {
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
	item, err := m.repo.UpdateCategoryStatus(c.Request.Context(), id, status)
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

func (m *Module) DeleteCategory(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := m.repo.DeleteCategory(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": dbx.PublicError(err, "Kategoriyani o‘chirib bo‘lmadi")})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (m *Module) CreateSubcategory(c *gin.Context) {
	catID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req CreateSubcategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}
	status := normalizeStatus(req.Status)
	item := &Subcategory{CategoryID: catID, Name: name, Status: status}
	if err := m.repo.CreateSubcategory(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (m *Module) UpdateSubcategory(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req UpdateSubcategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}
	status := normalizeStatus(req.Status)
	item, err := m.repo.UpdateSubcategory(c.Request.Context(), id, name, status)
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

func (m *Module) UpdateSubcategoryStatus(c *gin.Context) {
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
	item, err := m.repo.UpdateSubcategoryStatus(c.Request.Context(), id, status)
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

func (m *Module) DeleteSubcategory(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := m.repo.DeleteSubcategory(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": dbx.PublicError(err, "Subkategoriyani o‘chirib bo‘lmadi")})
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
	allowed := map[string]bool{
		".jpg": true, ".jpeg": true, ".jfif": true,
		".png": true, ".webp": true, ".gif": true, ".avif": true,
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
	isImage := strings.HasPrefix(ctype, "image/")

	if !allowed[ext] {
		// Extension unknown — still accept if MIME is an image
		switch ctype {
		case "image/jpeg":
			ext = ".jpg"
		case "image/png":
			ext = ".png"
		case "image/webp":
			ext = ".webp"
		case "image/gif":
			ext = ".gif"
		case "image/avif":
			ext = ".avif"
		default:
			if !isImage {
				c.JSON(http.StatusBadRequest, gin.H{"error": "only jpg/png/webp/gif/avif"})
				return
			}
			ext = ".img"
		}
	} else if !isImage && ctype != "application/octet-stream" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is not an image"})
		return
	}

	name := uuid.New().String() + ext
	dir := filepath.Join(m.uploadDir, "categories")
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

	c.JSON(http.StatusCreated, gin.H{"url": "/uploads/categories/" + name})
}

func (m *Module) ReorderCategories(c *gin.Context) {
	var req ReorderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := m.repo.ReorderCategories(c.Request.Context(), req.IDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (m *Module) ReorderSubcategories(c *gin.Context) {
	var req ReorderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := m.repo.ReorderSubcategories(c.Request.Context(), req.IDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
