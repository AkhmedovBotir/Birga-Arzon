package models

import "time"

type User struct {
	ID                string     `json:"id"`
	Role              string     `json:"role"`
	Phone             string     `json:"phone"`
	PhoneMasked       string     `json:"phoneMasked"`
	FirstName         string     `json:"firstName"`
	LastName          string     `json:"lastName"`
	RegionID          *string    `json:"regionId"`
	CityID            *string    `json:"cityId"`
	MfyID             *string    `json:"mfyId"`
	RegionName        *string    `json:"regionName,omitempty"`
	CityName          *string    `json:"cityName,omitempty"`
	MfyName           *string    `json:"mfyName,omitempty"`
	DeliveryLat       *float64   `json:"deliveryLat"`
	DeliveryLng       *float64   `json:"deliveryLng"`
	DeliveryAddress   *string    `json:"deliveryAddress"`
	TelegramID        *int64     `json:"telegramId,omitempty"`
	ProfileCompleted  bool       `json:"profileCompleted"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}

type City struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	RegionID *string `json:"regionId,omitempty"`
}

type Mfy struct {
	ID            string   `json:"id"`
	CityID        string   `json:"cityId"`
	Name          string   `json:"name"`
	PickupAddress *string  `json:"pickupAddress"`
	Lat           *float64 `json:"lat"`
	Lng           *float64 `json:"lng"`
}

type GroupBuy struct {
	ID                     string    `json:"id"`
	Title                  string    `json:"title"`
	Description            string    `json:"description"`
	PhotoURL               *string   `json:"photoUrl"`
	PhotoURLs              []string  `json:"photoUrls,omitempty"`
	ProductID              *string   `json:"productId,omitempty"`
	UnitLabel              string    `json:"unitLabel"`
	UnitPriceUzs           int64     `json:"unitPriceUzs"`
	MinVolume              int       `json:"minVolume"`
	CurrentVolume          int       `json:"currentVolume"`
	Status                 string    `json:"status"`
	CashOnDeliveryAllowed  bool      `json:"cashOnDeliveryAllowed"`
	CreatedAt              time.Time `json:"createdAt"`
}

type CartItem struct {
	GroupBuyID   string `json:"groupBuyId"`
	Title        string `json:"title"`
	UnitLabel    string `json:"unitLabel"`
	UnitPriceUzs int64  `json:"unitPriceUzs"`
	Quantity     int    `json:"quantity"`
	PhotoURL     *string `json:"photoUrl"`
	MinVolume    int    `json:"minVolume"`
	CurrentVolume int   `json:"currentVolume"`
	Status       string `json:"status"`
}

type OrderItem struct {
	ID           string  `json:"id"`
	GroupBuyID   string  `json:"groupBuyId"`
	ProductID    *string `json:"productId,omitempty"`
	Title        string  `json:"title"`
	Quantity     int     `json:"quantity"`
	UnitPriceUzs int64   `json:"unitPriceUzs"`
	UnitLabel    string  `json:"unitLabel"`
}

type Order struct {
	ID                 string      `json:"id"`
	UserID             string      `json:"userId"`
	DeliveryMethod     string      `json:"deliveryMethod"`
	DeliveryFeeUzs     int64       `json:"deliveryFeeUzs"`
	PaymentProvider    *string     `json:"paymentProvider"`
	Status             string      `json:"status"`
	PaymentDeadlineAt  *time.Time  `json:"paymentDeadlineAt"`
	CityID             *string     `json:"cityId"`
	MfyID              *string     `json:"mfyId"`
	DeliveryLat        *float64    `json:"deliveryLat"`
	DeliveryLng        *float64    `json:"deliveryLng"`
	DeliveryAddress    *string     `json:"deliveryAddress"`
	Items              []OrderItem `json:"items"`
	SubtotalUzs        int64       `json:"subtotalUzs"`
	TotalUzs           int64       `json:"totalUzs"`
	CustomerName       string      `json:"customerName,omitempty"`
	CustomerPhone      string      `json:"customerPhone,omitempty"`
	CreatedAt          time.Time   `json:"createdAt"`
	HasPickupCode      bool        `json:"hasPickupCode"`
	PickupCode         string      `json:"pickupCode,omitempty"`
}

type Leftover struct {
	ID         string    `json:"id"`
	GroupBuyID string    `json:"groupBuyId"`
	Title      string    `json:"title"`
	Quantity   int       `json:"quantity"`
	Reason     string    `json:"reason"`
	CreatedAt  time.Time `json:"createdAt"`
}

type Payment struct {
	ID          string `json:"id"`
	OrderID     string `json:"orderId"`
	Provider    string `json:"provider"`
	AmountUzs   int64  `json:"amountUzs"`
	Status      string `json:"status"`
	CheckoutURL string `json:"checkoutUrl"`
}
