package sms

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const defaultBaseURL = "https://notify.eskiz.uz/api"

// Approved Eskiz template — matn aniq shu bo‘lishi kerak.
const otpTemplate = "birgaarzon.uz saytiga kirish uchun tasdiqlash kodi: %s. Kodni begonalarga oshkor qilmang!"

// Client is a thread-safe Eskiz.uz SMS gateway client with JWT caching.
// Docs: https://documenter.getpostman.com/view/663428/RzfmES4z
type Client struct {
	email    string
	password string
	from     string
	baseURL  string
	http     *http.Client

	mu    sync.Mutex
	token string
}

func NewEskiz(email, password, from string) *Client {
	return &Client{
		email:    strings.TrimSpace(email),
		password: password,
		from:     strings.TrimSpace(from),
		baseURL:  defaultBaseURL,
		http:     &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *Client) Enabled() bool {
	return c != nil && c.email != "" && c.password != "" && c.from != ""
}

// SendOTP sends the approved OTP template. phone: +998… or 998… or 9 local digits.
func (c *Client) SendOTP(ctx context.Context, phone, code string) error {
	if !c.Enabled() {
		return fmt.Errorf("eskiz sozlanmagan (ESKIZ_EMAIL / ESKIZ_PASSWORD / ESKIZ_FROM)")
	}
	return c.Send(ctx, phone, fmt.Sprintf(otpTemplate, code))
}

func (c *Client) Send(ctx context.Context, phone, message string) error {
	mobile, err := normalizeMobile(phone)
	if err != nil {
		return err
	}
	return c.sendWithAuth(ctx, mobile, message, true)
}

func (c *Client) sendWithAuth(ctx context.Context, mobile, message string, allowRetry bool) error {
	token, err := c.getToken(ctx)
	if err != nil {
		return err
	}

	form := url.Values{}
	form.Set("mobile_phone", mobile)
	form.Set("message", message)
	form.Set("from", c.from)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.baseURL+"/message/sms/send",
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", "Bearer "+token)

	res, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("eskiz send: %w", err)
	}
	defer res.Body.Close()
	respBody, _ := io.ReadAll(res.Body)

	if res.StatusCode == http.StatusUnauthorized && allowRetry {
		c.clearToken()
		if _, err := c.login(ctx); err != nil {
			return err
		}
		return c.sendWithAuth(ctx, mobile, message, false)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("eskiz send failed (%d): %s", res.StatusCode, truncate(string(respBody), 300))
	}
	return nil
}

func (c *Client) getToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	tok := c.token
	c.mu.Unlock()
	if tok != "" {
		return tok, nil
	}
	return c.login(ctx)
}

func (c *Client) clearToken() {
	c.mu.Lock()
	c.token = ""
	c.mu.Unlock()
}

func (c *Client) login(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.token != "" {
		return c.token, nil
	}

	form := url.Values{}
	form.Set("email", c.email)
	form.Set("password", c.password)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.baseURL+"/auth/login",
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	res, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("eskiz login: %w", err)
	}
	defer res.Body.Close()
	respBody, _ := io.ReadAll(res.Body)

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", fmt.Errorf("eskiz login failed (%d): %s", res.StatusCode, truncate(string(respBody), 300))
	}

	var parsed struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", fmt.Errorf("eskiz login parse: %w", err)
	}
	if parsed.Data.Token == "" {
		return "", fmt.Errorf("eskiz login: token yo‘q")
	}
	c.token = parsed.Data.Token
	return c.token, nil
}

func normalizeMobile(phone string) (string, error) {
	var b strings.Builder
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	d := b.String()
	if strings.HasPrefix(d, "998") && len(d) == 12 {
		return d, nil
	}
	if len(d) == 9 {
		return "998" + d, nil
	}
	return "", fmt.Errorf("invalid phone for eskiz")
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
