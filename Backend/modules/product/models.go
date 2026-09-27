package product

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Product struct {
	ID            uuid.UUID       `json:"id"`
	CategoryID    uuid.UUID       `json:"category_id"`
	SubcategoryID uuid.UUID       `json:"subcategory_id"`
	Name          string          `json:"name"`
	Description   json.RawMessage `json:"description"`
	Unit          string          `json:"unit"`
	UnitSize      float64         `json:"unit_size"`
	Stock         int             `json:"stock"`
	Price         int64           `json:"price"`
	Images        []string        `json:"images"`
	Status        string          `json:"status"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`

	CategoryName    string `json:"category_name,omitempty"`
	SubcategoryName string `json:"subcategory_name,omitempty"`
}

type ProductListItem struct {
	ID              uuid.UUID `json:"id"`
	CategoryID      uuid.UUID `json:"category_id"`
	SubcategoryID   uuid.UUID `json:"subcategory_id"`
	Name            string    `json:"name"`
	Unit            string    `json:"unit"`
	UnitSize        float64   `json:"unit_size"`
	Stock           int       `json:"stock"`
	Price           int64     `json:"price"`
	Images          []string  `json:"images"`
	Status          string    `json:"status"`
	CategoryName    string    `json:"category_name"`
	SubcategoryName string    `json:"subcategory_name"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type UpsertRequest struct {
	CategoryID    string          `json:"category_id"`
	SubcategoryID string          `json:"subcategory_id"`
	Name          string          `json:"name"`
	Description   json.RawMessage `json:"description"`
	Unit          string          `json:"unit"`
	UnitSize      float64         `json:"unit_size"`
	Stock         int             `json:"stock"`
	Price         int64           `json:"price"`
	Images        []string        `json:"images"`
	Status        string          `json:"status"`
}

type StatusRequest struct {
	Status string `json:"status"`
}

type Stats struct {
	Total    int `json:"total"`
	Active   int `json:"active"`
	Inactive int `json:"inactive"`
}
