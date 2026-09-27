package user

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID              uuid.UUID  `json:"id"`
	Phone           string     `json:"phone"`
	FirstName       string     `json:"first_name"`
	LastName        string     `json:"last_name"`
	FullName        string     `json:"full_name"`
	ViloyatID       *uuid.UUID `json:"viloyat_id,omitempty"`
	TumanID         *uuid.UUID `json:"tuman_id,omitempty"`
	Lat             *float64   `json:"lat,omitempty"`
	Lng             *float64   `json:"lng,omitempty"`
	ProfileComplete bool       `json:"profile_complete"`
	IsBlocked       bool       `json:"is_blocked"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type SendOTPRequest struct {
	Phone string `json:"phone"`
}

type VerifyOTPRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

type CompleteProfileRequest struct {
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	ViloyatID uuid.UUID `json:"viloyat_id"`
	TumanID   uuid.UUID `json:"tuman_id"`
	Lat       float64   `json:"lat"`
	Lng       float64   `json:"lng"`
}

type AuthResponse struct {
	Token        string `json:"token"`
	NeedsProfile bool   `json:"needs_profile"`
	User         *User  `json:"user"`
}
