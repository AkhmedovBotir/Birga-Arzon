package handler

import (
	"net/http"
	"strconv"
	"strings"

	"jamaoxarid/backend/internal/httpx"
	"jamaoxarid/backend/internal/models"

	"github.com/go-chi/chi/v5"
)

func (h *Handler) Categories(w http.ResponseWriter, r *http.Request) {
	items, err := h.App.Store.Categories(r.Context())
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || strings.TrimSpace(body.Name) == "" {
		httpx.Error(w, 400, "Nom kerak")
		return
	}
	c, err := h.App.Store.CreateCategory(r.Context(), body.Name)
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, c)
}

func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || strings.TrimSpace(body.Name) == "" {
		httpx.Error(w, 400, "Nom kerak")
		return
	}
	if err := h.App.Store.UpdateCategory(r.Context(), chi.URLParam(r, "id"), body.Name); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	if err := h.App.Store.DeleteCategory(r.Context(), chi.URLParam(r, "id")); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) Subcategories(w http.ResponseWriter, r *http.Request) {
	items, err := h.App.Store.Subcategories(r.Context(), r.URL.Query().Get("categoryId"))
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) CreateSubcategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CategoryID string `json:"categoryId"`
		Name       string `json:"name"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || body.CategoryID == "" || strings.TrimSpace(body.Name) == "" {
		httpx.Error(w, 400, "Kategoriya va nom kerak")
		return
	}
	c, err := h.App.Store.CreateSubcategory(r.Context(), body.CategoryID, body.Name)
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, c)
}

func (h *Handler) UpdateSubcategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || strings.TrimSpace(body.Name) == "" {
		httpx.Error(w, 400, "Nom kerak")
		return
	}
	if err := h.App.Store.UpdateSubcategory(r.Context(), chi.URLParam(r, "id"), body.Name); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) DeleteSubcategory(w http.ResponseWriter, r *http.Request) {
	if err := h.App.Store.DeleteSubcategory(r.Context(), chi.URLParam(r, "id")); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) Products(w http.ResponseWriter, r *http.Request) {
	items, err := h.App.Store.Products(r.Context(), r.URL.Query().Get("subcategoryId"))
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func productFromBody(body models.Product) models.Product {
	body.Name = strings.TrimSpace(body.Name)
	if body.UnitLabel == "" {
		body.UnitLabel = "dona"
	}
	if body.Stock < 0 {
		body.Stock = 0
	}
	body.Active = true
	return body
}

func (h *Handler) readProductForm(r *http.Request) models.Product {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		_ = r.ParseForm()
	}
	price, _ := strconv.ParseInt(firstVal(r, "unitPriceUzs"), 10, 64)
	stock, _ := strconv.Atoi(firstVal(r, "stock"))
	p := models.Product{
		SubcategoryID: strings.TrimSpace(firstVal(r, "subcategoryId")),
		Name:          strings.TrimSpace(firstVal(r, "name")),
		Description:   firstVal(r, "description"),
		UnitLabel:     firstVal(r, "unitLabel"),
		UnitPriceUzs:  price,
		Stock:         stock,
		Active:        true,
	}
	if url := h.readSinglePhoto(r, "photo"); url != "" {
		p.PhotoURL = &url
	} else if keep := strings.TrimSpace(firstVal(r, "keepPhoto")); keep != "" {
		p.PhotoURL = &keep
	}
	return productFromBody(p)
}

func (h *Handler) readSinglePhoto(r *http.Request, field string) string {
	f, hdr, err := r.FormFile(field)
	if err != nil {
		return ""
	}
	defer f.Close()
	url, err := h.saveUpload(f, hdr.Filename)
	if err != nil {
		return ""
	}
	return url
}

func (h *Handler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	var body models.Product
	if strings.Contains(r.Header.Get("Content-Type"), "multipart/form-data") {
		p := h.readProductForm(r)
		if p.SubcategoryID == "" || p.Name == "" {
			httpx.Error(w, 400, "Subkategoriya va nom kerak")
			return
		}
		if p.PhotoURL == nil {
			httpx.Error(w, 400, "mahsulot rasmini yuklang")
			return
		}
		created, err := h.App.Store.CreateProduct(r.Context(), p)
		if err != nil {
			httpx.Error(w, 400, err.Error())
			return
		}
		httpx.JSON(w, 200, created)
		return
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || body.SubcategoryID == "" || strings.TrimSpace(body.Name) == "" {
		httpx.Error(w, 400, "Subkategoriya va nom kerak")
		return
	}
	body.Active = true
	p, err := h.App.Store.CreateProduct(r.Context(), productFromBody(body))
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, p)
}

func (h *Handler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	existing, err := h.App.Store.Product(r.Context(), id)
	if err != nil || existing == nil {
		httpx.Error(w, 404, "Mahsulot topilmadi")
		return
	}
	var body models.Product
	if strings.Contains(r.Header.Get("Content-Type"), "multipart/form-data") {
		p := h.readProductForm(r)
		if p.Name == "" {
			httpx.Error(w, 400, "Nom kerak")
			return
		}
		p.ID = id
		if p.SubcategoryID == "" {
			p.SubcategoryID = existing.SubcategoryID
		}
		p.Active = existing.Active
		if p.PhotoURL == nil {
			p.PhotoURL = existing.PhotoURL
		}
		if err := h.App.Store.UpdateProduct(r.Context(), p); err != nil {
			httpx.Error(w, 400, err.Error())
			return
		}
		httpx.JSON(w, 200, map[string]any{"ok": true})
		return
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || strings.TrimSpace(body.Name) == "" {
		httpx.Error(w, 400, "Nom kerak")
		return
	}
	body.ID = id
	if body.UnitLabel == "" {
		body.UnitLabel = "dona"
	}
	if body.Stock < 0 {
		body.Stock = 0
	}
	if body.SubcategoryID == "" {
		body.SubcategoryID = existing.SubcategoryID
		body.Active = existing.Active
	}
	if body.PhotoURL == nil {
		body.PhotoURL = existing.PhotoURL
	}
	if err := h.App.Store.UpdateProduct(r.Context(), body); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	if err := h.App.Store.DeleteProduct(r.Context(), chi.URLParam(r, "id")); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h *Handler) AdminStock(w http.ResponseWriter, r *http.Request) {
	items, err := h.App.Store.StockMoves(r.Context(), r.URL.Query().Get("productId"))
	if err != nil {
		httpx.Error(w, 500, err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}

func (h *Handler) AdminMoveStock(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ProductID string `json:"productId"`
		Kind      string `json:"kind"`
		Quantity  int    `json:"quantity"`
		Note      string `json:"note"`
	}
	if err := httpx.DecodeLoose(r, &body); err != nil || body.ProductID == "" || body.Quantity <= 0 {
		httpx.Error(w, 400, "Mahsulot va miqdor kerak")
		return
	}
	u := UserFrom(r.Context())
	if err := h.App.Store.MoveStock(r.Context(), body.ProductID, body.Kind, body.Quantity, body.Note, "manual", "", u.ID); err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	p, _ := h.App.Store.Product(r.Context(), body.ProductID)
	httpx.JSON(w, 200, p)
}
