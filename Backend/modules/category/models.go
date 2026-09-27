package category

import (
	"time"

	"github.com/google/uuid"
)

type Category struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Icon      string    `json:"icon"`
	Image     string    `json:"image"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Subcategory struct {
	ID         uuid.UUID `json:"id"`
	CategoryID uuid.UUID `json:"category_id"`
	Name       string    `json:"name"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type SubcategoryNode struct {
	ID     uuid.UUID `json:"id"`
	Name   string    `json:"name"`
	Status string    `json:"status"`
}

type CategoryNode struct {
	ID            uuid.UUID         `json:"id"`
	Name          string            `json:"name"`
	Icon          string            `json:"icon"`
	Image         string            `json:"image"`
	Status        string            `json:"status"`
	ChildrenCount int               `json:"children_count"`
	Children      []SubcategoryNode `json:"children"`
}

type CreateCategoryRequest struct {
	Name   string `json:"name"`
	Icon   string `json:"icon"`
	Image  string `json:"image"`
	Status string `json:"status"`
}

type UpdateCategoryRequest struct {
	Name   string `json:"name"`
	Icon   string `json:"icon"`
	Image  string `json:"image"`
	Status string `json:"status"`
}

type CreateSubcategoryRequest struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

type UpdateSubcategoryRequest struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

type StatusRequest struct {
	Status string `json:"status"`
}

type Stats struct {
	Categories    int `json:"categories"`
	Subcategories int `json:"subcategories"`
}
