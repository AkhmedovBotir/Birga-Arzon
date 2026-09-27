package kuryer

import (
	"time"

	"github.com/google/uuid"
)

type Kuryer struct {
	ID           uuid.UUID  `json:"id"`
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	Phone        string     `json:"phone"`
	PasswordHash string     `json:"-"`
	ViloyatID    *uuid.UUID `json:"viloyat_id"`
	TumanID      *uuid.UUID `json:"tuman_id"`
	IsActive     bool       `json:"is_active"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	ViloyatName  string     `json:"viloyat_name,omitempty"`
	TumanName    string     `json:"tuman_name,omitempty"`
	FullName     string     `json:"full_name,omitempty"`
}

func (k *Kuryer) WithFullName() *Kuryer {
	k.FullName = stringsTrim(k.FirstName + " " + k.LastName)
	if k.FullName == "" {
		k.FullName = k.Phone
	}
	return k
}

func stringsTrim(s string) string {
	b := make([]byte, 0, len(s))
	prevSpace := true
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c == ' ' || c == '\t' {
			if !prevSpace && len(b) > 0 {
				b = append(b, ' ')
				prevSpace = true
			}
			continue
		}
		b = append(b, c)
		prevSpace = false
	}
	for len(b) > 0 && b[len(b)-1] == ' ' {
		b = b[:len(b)-1]
	}
	return string(b)
}

type PublicKuryer struct {
	ID          uuid.UUID  `json:"id"`
	FirstName   string     `json:"first_name"`
	LastName    string     `json:"last_name"`
	FullName    string     `json:"full_name"`
	Phone       string     `json:"phone"`
	ViloyatID   *uuid.UUID `json:"viloyat_id"`
	TumanID     *uuid.UUID `json:"tuman_id"`
	ViloyatName string     `json:"viloyat_name,omitempty"`
	TumanName   string     `json:"tuman_name,omitempty"`
	IsActive    bool       `json:"is_active"`
}

func (k *Kuryer) Public() PublicKuryer {
	k.WithFullName()
	return PublicKuryer{
		ID:          k.ID,
		FirstName:   k.FirstName,
		LastName:    k.LastName,
		FullName:    k.FullName,
		Phone:       k.Phone,
		ViloyatID:   k.ViloyatID,
		TumanID:     k.TumanID,
		ViloyatName: k.ViloyatName,
		TumanName:   k.TumanName,
		IsActive:    k.IsActive,
	}
}

type CreateRequest struct {
	FirstName string  `json:"first_name"`
	LastName  string  `json:"last_name"`
	Phone     string  `json:"phone"`
	Password  string  `json:"password"`
	ViloyatID *string `json:"viloyat_id"`
	TumanID   *string `json:"tuman_id"`
	IsActive  *bool   `json:"is_active"`
}

type UpdateRequest struct {
	FirstName string  `json:"first_name"`
	LastName  string  `json:"last_name"`
	Phone     string  `json:"phone"`
	Password  string  `json:"password"`
	ViloyatID *string `json:"viloyat_id"`
	TumanID   *string `json:"tuman_id"`
	IsActive  bool    `json:"is_active"`
}

type StatusRequest struct {
	IsActive bool `json:"is_active"`
}

type LoginRequest struct {
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token  string       `json:"token"`
	Kuryer PublicKuryer `json:"kuryer"`
}

type Stats struct {
	Total    int `json:"total"`
	Active   int `json:"active"`
	Inactive int `json:"inactive"`
}

type Dashboard struct {
	Kuryer      PublicKuryer `json:"kuryer"`
	Deliveries  int          `json:"deliveries"`
	Pending     int          `json:"pending"`
	Completed   int          `json:"completed"`
	TodayHint   string       `json:"today_hint"`
}
