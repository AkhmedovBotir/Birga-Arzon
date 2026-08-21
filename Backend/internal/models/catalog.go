package models

type Region struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Code string `json:"code,omitempty"`
}

type Category struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"createdAt,omitempty"`
}

type Subcategory struct {
	ID         string `json:"id"`
	CategoryID string `json:"categoryId"`
	Name       string `json:"name"`
}

type Product struct {
	ID             string  `json:"id"`
	SubcategoryID  string  `json:"subcategoryId"`
	CategoryID     string  `json:"categoryId,omitempty"`
	CategoryName   string  `json:"categoryName,omitempty"`
	SubcategoryName string `json:"subcategoryName,omitempty"`
	Name           string  `json:"name"`
	Description    string  `json:"description"`
	UnitLabel      string  `json:"unitLabel"`
	UnitPriceUzs   int64   `json:"unitPriceUzs"`
	PhotoURL       *string `json:"photoUrl"`
	Stock          int     `json:"stock"`
	Active         bool    `json:"active"`
}

type StockMove struct {
	ID        string `json:"id"`
	ProductID string `json:"productId"`
	ProductName string `json:"productName,omitempty"`
	Kind      string `json:"kind"`
	Quantity  int    `json:"quantity"`
	Note      string `json:"note"`
	CreatedAt string `json:"createdAt"`
}
