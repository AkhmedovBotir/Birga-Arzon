package admin

import (
	"time"

	"github.com/google/uuid"
)

const (
	RoleGeneral = "general"
	RoleAdmin   = "admin"
)

type Admin struct {
	ID           uuid.UUID  `json:"id"`
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	Phone        string     `json:"phone"`
	Role         string     `json:"role"`
	Username     string     `json:"username"`
	PasswordHash string     `json:"-"`
	IsActive     bool       `json:"is_active"`
	CreatedBy    *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type PublicAdmin struct {
	ID        uuid.UUID  `json:"id"`
	FirstName string     `json:"first_name"`
	LastName  string     `json:"last_name"`
	Phone     string     `json:"phone"`
	Role      string     `json:"role"`
	Username  string     `json:"username"`
	IsActive  bool       `json:"is_active"`
	CreatedBy *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

func (a Admin) Public() PublicAdmin {
	return PublicAdmin{
		ID:        a.ID,
		FirstName: a.FirstName,
		LastName:  a.LastName,
		Phone:     a.Phone,
		Role:      a.Role,
		Username:  a.Username,
		IsActive:  a.IsActive,
		CreatedBy: a.CreatedBy,
		CreatedAt: a.CreatedAt,
		UpdatedAt: a.UpdatedAt,
	}
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type CreateAdminRequest struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Phone     string `json:"phone"`
	Username  string `json:"username"`
	Password  string `json:"password"`
}

type UpdateAdminRequest struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Phone     string `json:"phone"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	IsActive  *bool  `json:"is_active"`
}

type LoginResponse struct {
	Token string      `json:"token"`
	Admin PublicAdmin `json:"admin"`
}
