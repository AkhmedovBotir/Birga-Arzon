package order

import (
	"time"

	"github.com/google/uuid"
)

const (
	StatusWaiting   = "waiting"
	StatusReady     = "ready"
	StatusAssigned  = "assigned"
	StatusDelivered = "delivered"
	StatusCancelled = "cancelled"

	PaymentUnpaid  = "unpaid"
	PaymentPending = "pending"
	PaymentPaid    = "paid"
	PaymentCOD     = "cod"

	MethodCard = "card"
	MethodCash = "cash"
)

type OrderItem struct {
	ID          uuid.UUID  `json:"id"`
	OrderID     uuid.UUID  `json:"order_id"`
	YigimID     uuid.UUID  `json:"yigim_id"`
	ProductID   *uuid.UUID `json:"product_id,omitempty"`
	ProductName string     `json:"product_name"`
	Unit        string     `json:"unit"`
	UnitPrice   float64    `json:"unit_price"`
	Qty         int        `json:"qty"`
	Image       string     `json:"image"`
	YigimStatus string     `json:"yigim_status,omitempty"`
	YigimName   string     `json:"yigim_name,omitempty"`
}

type Order struct {
	ID            uuid.UUID   `json:"id"`
	UserID        uuid.UUID   `json:"user_id"`
	Status        string      `json:"status"`
	DeliveryCode  string      `json:"delivery_code"`
	KuryerID      *uuid.UUID  `json:"kuryer_id,omitempty"`
	FirstName     string      `json:"first_name"`
	LastName      string      `json:"last_name"`
	Phone         string      `json:"phone"`
	ViloyatID     *uuid.UUID  `json:"viloyat_id,omitempty"`
	TumanID       *uuid.UUID  `json:"tuman_id,omitempty"`
	ViloyatName   string      `json:"viloyat_name"`
	TumanName     string      `json:"tuman_name"`
	Lat           *float64    `json:"lat,omitempty"`
	Lng           *float64    `json:"lng,omitempty"`
	TotalAmount   float64     `json:"total_amount"`
	DeliveryFee   float64     `json:"delivery_fee"`
	PayableAmount float64     `json:"payable_amount"`
	PaymentStatus string      `json:"payment_status"`
	PaymentMethod string      `json:"payment_method"`
	AtmosPaymentID string     `json:"atmos_payment_id,omitempty"`
	AtmosInvoice  string      `json:"atmos_invoice,omitempty"`
	PaidAt        *time.Time  `json:"paid_at,omitempty"`
	Note          string      `json:"note"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
	AssignedAt    *time.Time  `json:"assigned_at,omitempty"`
	DeliveredAt   *time.Time  `json:"delivered_at,omitempty"`
	Items         []OrderItem `json:"items"`
	KuryerName    string      `json:"kuryer_name,omitempty"`
	KuryerPhone   string      `json:"kuryer_phone,omitempty"`
	UserFullName  string      `json:"user_full_name,omitempty"`
	StatusLabel   string      `json:"status_label,omitempty"`
	NeedsPayment  bool        `json:"needs_payment"`
}

func StatusLabel(s string) string {
	switch s {
	case StatusWaiting:
		return "Yig‘im kutilmoqda"
	case StatusReady:
		return "Kuryerga tayyor"
	case StatusAssigned:
		return "Yetkazilmoqda"
	case StatusDelivered:
		return "Yetkazildi"
	case StatusCancelled:
		return "Bekor qilindi"
	default:
		return s
	}
}

func (o *Order) WithLabels() *Order {
	o.StatusLabel = StatusLabel(o.Status)
	o.PayableAmount = o.TotalAmount + o.DeliveryFee
	o.NeedsPayment = (o.Status == StatusReady || o.Status == StatusAssigned) &&
		(o.PaymentStatus == PaymentUnpaid || o.PaymentStatus == PaymentPending)
	return o
}

// HideDeliveryCodeUntilPaid strips the code from API responses until the order is paid or COD.
func (o *Order) HideDeliveryCodeUntilPaid() *Order {
	if o.PaymentStatus != PaymentPaid && o.PaymentStatus != PaymentCOD {
		o.DeliveryCode = ""
	}
	return o
}

type CreateItemInput struct {
	YigimID string `json:"yigim_id"`
	Qty     int    `json:"qty"`
}

type CreateRequest struct {
	Items []CreateItemInput `json:"items"`
	Note  string            `json:"note"`
}

type AssignRequest struct {
	KuryerID string `json:"kuryer_id"`
}

type StatusRequest struct {
	Status string `json:"status"`
}

type DeliverRequest struct {
	Code string `json:"code"`
}

type Stats struct {
	Total     int `json:"total"`
	Waiting   int `json:"waiting"`
	Ready     int `json:"ready"`
	Assigned  int `json:"assigned"`
	Delivered int `json:"delivered"`
	Cancelled int `json:"cancelled"`
}
