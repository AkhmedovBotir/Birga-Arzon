package region

import (
	"time"

	"github.com/google/uuid"
)

const (
	TypeViloyat = "viloyat"
	TypeTuman   = "tuman"
	TypeMFY     = "mfy"
)

type Region struct {
	ID        uuid.UUID  `json:"id"`
	LegacyID  string     `json:"legacy_id"`
	Name      string     `json:"name"`
	Code      string     `json:"code"`
	Type      string     `json:"type"`
	ParentID  *uuid.UUID `json:"parent_id,omitempty"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type RegionNode struct {
	ID           uuid.UUID    `json:"id"`
	Name         string       `json:"name"`
	Code         string       `json:"code"`
	Type         string       `json:"type"`
	Status       string       `json:"status"`
	ChildrenCount int         `json:"children_count"`
	Children     []RegionNode `json:"children,omitempty"`
}

type Stats struct {
	Viloyat int `json:"viloyat"`
	Tuman   int `json:"tuman"`
	MFY     int `json:"mfy"`
}

type CreateRegionRequest struct {
	Name     string     `json:"name"`
	Code     string     `json:"code"`
	Type     string     `json:"type"`
	ParentID *uuid.UUID `json:"parent_id"`
	Status   string     `json:"status"`
}

type UpdateRegionRequest struct {
	Name   string `json:"name"`
	Code   string `json:"code"`
	Status string `json:"status"`
}

type StatusRequest struct {
	Status string `json:"status"`
}
