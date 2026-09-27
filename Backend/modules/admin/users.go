package admin

import (
	"errors"
	"net/http"
	"strings"

	"birgaarzon/backend/internal/dbx"
	usermod "birgaarzon/backend/modules/user"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

type AdminUserCreateRequest struct {
	Phone           string     `json:"phone"`
	FirstName       string     `json:"first_name"`
	LastName        string     `json:"last_name"`
	ViloyatID       *uuid.UUID `json:"viloyat_id"`
	TumanID         *uuid.UUID `json:"tuman_id"`
	Lat             *float64   `json:"lat"`
	Lng             *float64   `json:"lng"`
	ProfileComplete *bool      `json:"profile_complete"`
	IsBlocked       *bool      `json:"is_blocked"`
}

type AdminUserUpdateRequest struct {
	Phone           string     `json:"phone"`
	FirstName       string     `json:"first_name"`
	LastName        string     `json:"last_name"`
	ViloyatID       *uuid.UUID `json:"viloyat_id"`
	TumanID         *uuid.UUID `json:"tuman_id"`
	Lat             *float64   `json:"lat"`
	Lng             *float64   `json:"lng"`
	ProfileComplete bool       `json:"profile_complete"`
	IsBlocked       bool       `json:"is_blocked"`
}

type AdminUserBlockRequest struct {
	IsBlocked bool `json:"is_blocked"`
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// ListUsers godoc
// @Summary      List app users
// @Tags         admin-users
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /api/v1/admin/users [get]
func (m *Module) ListUsers(c *gin.Context) {
	list, err := m.userRepo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list})
}

// CreateUser godoc
// @Summary      Create app user
// @Tags         admin-users
// @Accept       json
// @Produce      json
// @Param        body  body  AdminUserCreateRequest  true  "user"
// @Success      201   {object}  user.User
// @Router       /api/v1/admin/users [post]
func (m *Module) CreateUser(c *gin.Context) {
	var req AdminUserCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	phone, err := usermod.NormalizePhone(req.Phone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "telefon raqam noto‘g‘ri"})
		return
	}
	exists, err := m.userRepo.PhoneExists(c.Request.Context(), phone, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "bu telefon band"})
		return
	}

	first := strings.TrimSpace(req.FirstName)
	last := strings.TrimSpace(req.LastName)
	complete := false
	if req.ProfileComplete != nil {
		complete = *req.ProfileComplete
	} else if first != "" && last != "" && req.ViloyatID != nil && req.TumanID != nil {
		complete = true
	}

	blocked := false
	if req.IsBlocked != nil {
		blocked = *req.IsBlocked
	}

	u, err := m.userRepo.CreateFull(
		c.Request.Context(),
		phone, first, last,
		req.ViloyatID, req.TumanID,
		req.Lat, req.Lng,
		complete,
		blocked,
	)
	if err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "bu telefon band"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, u)
}

// UpdateUser godoc
// @Summary      Update app user
// @Tags         admin-users
// @Accept       json
// @Produce      json
// @Param        id    path  string  true  "user id"
// @Param        body  body  AdminUserUpdateRequest  true  "user"
// @Success      200   {object}  user.User
// @Router       /api/v1/admin/users/{id} [put]
func (m *Module) UpdateUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req AdminUserUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	phone, err := usermod.NormalizePhone(req.Phone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "telefon raqam noto‘g‘ri"})
		return
	}
	exists, err := m.userRepo.PhoneExists(c.Request.Context(), phone, &id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "bu telefon band"})
		return
	}

	u, err := m.userRepo.UpdateByAdmin(
		c.Request.Context(),
		id,
		phone,
		strings.TrimSpace(req.FirstName),
		strings.TrimSpace(req.LastName),
		req.ViloyatID, req.TumanID,
		req.Lat, req.Lng,
		req.ProfileComplete,
		req.IsBlocked,
	)
	if err != nil {
		if errors.Is(err, usermod.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "foydalanuvchi topilmadi"})
			return
		}
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "bu telefon band"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, u)
}

// SetUserBlocked godoc
// @Summary      Block or unblock app user
// @Tags         admin-users
// @Accept       json
// @Produce      json
// @Param        id    path  string  true  "user id"
// @Param        body  body  AdminUserBlockRequest  true  "block"
// @Success      200   {object}  user.User
// @Router       /api/v1/admin/users/{id}/block [patch]
func (m *Module) SetUserBlocked(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req AdminUserBlockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	u, err := m.userRepo.SetBlocked(c.Request.Context(), id, req.IsBlocked)
	if err != nil {
		if errors.Is(err, usermod.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "foydalanuvchi topilmadi"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, u)
}

// DeleteUser godoc
// @Summary      Delete app user
// @Tags         admin-users
// @Produce      json
// @Param        id  path  string  true  "user id"
// @Success      200  {object}  map[string]string
// @Router       /api/v1/admin/users/{id} [delete]
func (m *Module) DeleteUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := m.userRepo.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, usermod.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "foydalanuvchi topilmadi"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": dbx.PublicError(err, "Foydalanuvchini o‘chirib bo‘lmadi")})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
