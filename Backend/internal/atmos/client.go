package atmos

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"birgaarzon/backend/internal/config"
)

type Client struct {
	cfg        *config.Config
	http       *http.Client
	mu         sync.Mutex
	token      string
	tokenUntil time.Time
}

func NewClient(cfg *config.Config) *Client {
	return &Client{
		cfg:  cfg,
		http: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) Enabled() bool {
	return c.cfg.AtmosConsumerKey != "" &&
		c.cfg.AtmosConsumerSecret != "" &&
		c.cfg.AtmosStoreID != ""
}

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

func (c *Client) bearer(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.token != "" && time.Now().Before(c.tokenUntil) {
		return c.token, nil
	}
	if !c.Enabled() {
		return "", fmt.Errorf("Atmos sozlamalari to‘liq emas")
	}
	auth := base64.StdEncoding.EncodeToString(
		[]byte(c.cfg.AtmosConsumerKey + ":" + c.cfg.AtmosConsumerSecret),
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.AtmosBaseURL+"/token",
		strings.NewReader("grant_type=client_credentials"))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	res, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("atmos token: %s", string(body))
	}
	var tr tokenResponse
	if err := json.Unmarshal(body, &tr); err != nil {
		return "", err
	}
	if tr.AccessToken == "" {
		return "", fmt.Errorf("atmos token bo‘sh")
	}
	exp := tr.ExpiresIn
	if exp <= 0 {
		exp = 3600
	}
	c.token = tr.AccessToken
	c.tokenUntil = time.Now().Add(time.Duration(exp-60) * time.Second)
	return c.token, nil
}

type Result struct {
	Code        string `json:"code"`
	Description string `json:"description"`
}

type InvoiceCreateRequest struct {
	RequestID  string `json:"request_id"`
	StoreID    int    `json:"store_id"`
	Account    string `json:"account"`
	Amount     int64  `json:"amount"`
	SuccessURL string `json:"success_url"`
	Lang       string `json:"lang,omitempty"`
}

type InvoiceCreateResponse struct {
	Result        Result `json:"result"`
	PaymentID     any    `json:"payment_id"`
	TransactionID any    `json:"transaction_id"`
	InvoiceID     any    `json:"invoice_id"`
	Invoice       any    `json:"invoice"`
	ID            any    `json:"id"`
	Token         string `json:"token"`
	URL           string `json:"url"`
	PaymentURL    string `json:"payment_url"`
}

func (r *InvoiceCreateResponse) GetPaymentID() string {
	for _, v := range []any{r.PaymentID, r.TransactionID, r.ID} {
		if s := PaymentIDString(v); s != "" && s != "0" {
			return s
		}
	}
	return ""
}

func (r *InvoiceCreateResponse) GetInvoice() string {
	for _, v := range []any{r.Invoice, r.InvoiceID, r.PaymentID, r.TransactionID, r.ID} {
		if s := PaymentIDString(v); s != "" && s != "0" {
			return s
		}
	}
	return ""
}

func (c *Client) CreateInvoice(ctx context.Context, req InvoiceCreateRequest) (*InvoiceCreateResponse, error) {
	token, err := c.bearer(ctx)
	if err != nil {
		return nil, err
	}
	if req.StoreID == 0 {
		sid, err := strconv.Atoi(c.cfg.AtmosStoreID)
		if err != nil {
			return nil, fmt.Errorf("ATMOS_STORE_ID noto‘g‘ri")
		}
		req.StoreID = sid
	}
	payload, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.cfg.AtmosBaseURL+"/checkout/invoice/create", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+token)
	httpReq.Header.Set("Content-Type", "application/json")

	res, err := c.http.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	var out InvoiceCreateResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("atmos invoice parse: %w (%s)", err, string(body))
	}
	if res.StatusCode >= 300 || (out.Result.Code != "" && out.Result.Code != "OK") {
		desc := out.Result.Description
		if desc == "" {
			desc = string(body)
		}
		return nil, fmt.Errorf("atmos invoice: %s", desc)
	}
	if out.URL == "" && out.PaymentURL != "" {
		out.URL = out.PaymentURL
	}
	if out.URL == "" && out.Token != "" {
		out.URL = c.cfg.AtmosCheckoutURL + "/?token=" + out.Token
	}
	return &out, nil
}

type InvoiceStatusResult struct {
	Paid          bool
	StatusText    string
	TransactionID string
	Invoice       string
	Amount        float64
	Raw           []byte
}

type invoiceGetResponse struct {
	Result        Result `json:"result"`
	Status        any    `json:"status"`
	TransactionID any    `json:"transaction_id"`
	Invoice       any    `json:"invoice"`
	PaymentID     any    `json:"payment_id"`
	Amount        any    `json:"amount"`
}

func (c *Client) GetInvoice(ctx context.Context, token, paymentID string) (*InvoiceStatusResult, error) {
	bearerToken, err := c.bearer(ctx)
	if err != nil {
		return nil, err
	}
	reqBody := make(map[string]any)
	if strings.TrimSpace(token) != "" {
		reqBody["token"] = strings.TrimSpace(token)
	} else if strings.TrimSpace(paymentID) != "" {
		if idNum, err := strconv.ParseInt(strings.TrimSpace(paymentID), 10, 64); err == nil {
			reqBody["payment_id"] = idNum
		} else {
			reqBody["payment_id"] = strings.TrimSpace(paymentID)
		}
	} else {
		return nil, fmt.Errorf("token yoki payment_id berilmadi")
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.cfg.AtmosBaseURL+"/checkout/invoice/get", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+bearerToken)
	httpReq.Header.Set("Content-Type", "application/json")

	res, err := c.http.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)

	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("atmos invoice get: %s (%d)", string(body), res.StatusCode)
	}

	var out invoiceGetResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("atmos invoice get parse: %w (%s)", err, string(body))
	}

	isPaid := false
	statusDesc := ""
	if out.Result.Code == "OK" || out.Result.Code == "" {
		switch st := out.Status.(type) {
		case map[string]any:
			codeStr := fmt.Sprint(st["code"])
			statusDesc = fmt.Sprint(st["description"])
			if codeStr == "0" || codeStr == "1" || strings.EqualFold(codeStr, "OK") || strings.EqualFold(codeStr, "PAID") || strings.EqualFold(codeStr, "SUCCESS") {
				isPaid = true
			}
		case string:
			statusDesc = st
			if st == "0" || st == "1" || strings.EqualFold(st, "OK") || strings.EqualFold(st, "PAID") || strings.EqualFold(st, "SUCCESS") {
				isPaid = true
			}
		case float64:
			if st == 0 || st == 1 {
				isPaid = true
			}
		}
	}

	txID := PaymentIDString(out.TransactionID)
	if txID == "" {
		txID = PaymentIDString(out.PaymentID)
	}
	invID := PaymentIDString(out.Invoice)

	return &InvoiceStatusResult{
		Paid:          isPaid,
		StatusText:    statusDesc,
		TransactionID: txID,
		Invoice:       invID,
		Raw:           body,
	}, nil
}

type CallbackPayload struct {
	StoreID         any    `json:"store_id"`
	TransactionID   any    `json:"transaction_id"`
	TransactionTime string `json:"transaction_time"`
	Invoice         any    `json:"invoice"`
	Amount          any    `json:"amount"`
	Sign            string `json:"sign"`
	Account         any    `json:"account"`
	RequestID       any    `json:"request_id"`
	Token           any    `json:"token"`
	PaymentID       any    `json:"payment_id"`
}

func (p *CallbackPayload) InvoiceString() string {
	return PaymentIDString(p.Invoice)
}

func (p *CallbackPayload) TransactionIDString() string {
	if s := PaymentIDString(p.TransactionID); s != "" {
		return s
	}
	return PaymentIDString(p.PaymentID)
}

func (p *CallbackPayload) AccountString() string {
	return PaymentIDString(p.Account)
}

func (p *CallbackPayload) RequestIDString() string {
	return PaymentIDString(p.RequestID)
}

func (p *CallbackPayload) TokenString() string {
	return PaymentIDString(p.Token)
}

func (c *Client) VerifyCallback(p CallbackPayload) bool {
	if c.cfg.AtmosAPIKey == "" {
		return true
	}
	store := fmt.Sprint(p.StoreID)
	tx := PaymentIDString(p.TransactionID)
	inv := PaymentIDString(p.Invoice)
	amount := fmt.Sprint(p.Amount)
	raw := store + tx + inv + amount + c.cfg.AtmosAPIKey
	sum := md5.Sum([]byte(raw))
	expected := hex.EncodeToString(sum[:])
	return strings.EqualFold(expected, strings.TrimSpace(p.Sign))
}

func PaymentIDString(v any) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	case float64:
		return strconv.FormatInt(int64(t), 10)
	case int:
		return strconv.Itoa(t)
	case int64:
		return strconv.FormatInt(t, 10)
	case json.Number:
		return t.String()
	default:
		s := strings.TrimSpace(fmt.Sprint(v))
		if s == "<nil>" {
			return ""
		}
		return s
	}
}

func ToTiyin(amountUZS float64) int64 {
	return int64(amountUZS*100 + 0.5)
}
