package yigim

import (
	"time"

	"github.com/google/uuid"
)

type YigimItem struct {
	ID          uuid.UUID `json:"id,omitempty"`
	ProductID   uuid.UUID `json:"product_id"`
	Qty         int       `json:"qty"`
	ProductName string    `json:"product_name,omitempty"`
	ProductImage string   `json:"product_image,omitempty"`
}

type Yigim struct {
	ID          uuid.UUID   `json:"id"`
	Type        string      `json:"type"`
	Name        *string     `json:"name"`
	ProductID   *uuid.UUID  `json:"product_id"`
	TargetQty   int         `json:"target_qty"`
	CurrentQty  int         `json:"current_qty"`
	Images      []string    `json:"images"`
	Status      string      `json:"status"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
	ProductName string      `json:"product_name,omitempty"`
	Items       []YigimItem `json:"items"`
}

type UpsertRequest struct {
	Type       string          `json:"type"`
	Name       string          `json:"name"`
	ProductID  string          `json:"product_id"`
	TargetQty  int             `json:"target_qty"`
	CurrentQty *int            `json:"current_qty"`
	Images     []string        `json:"images"`
	Status     string          `json:"status"`
	Items      []UpsertItemReq `json:"items"`
}

type UpsertItemReq struct {
	ProductID string `json:"product_id"`
	Qty       int    `json:"qty"`
}

type StatusRequest struct {
	Status string `json:"status"`
}

type Stats struct {
	Total  int `json:"total"`
	Single int `json:"single"`
	Combo  int `json:"combo"`
	Open   int `json:"open"`
	Closed int `json:"closed"`
}
