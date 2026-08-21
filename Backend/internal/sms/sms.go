package sms

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type Sender struct {
	email    string
	password string
	from     string
	dev      bool

	mu    sync.Mutex
	token string
	until time.Time
}

func New(email, password, from string, dev bool) *Sender {
	return &Sender{email: email, password: password, from: from, dev: dev}
}

func (s *Sender) SendOTP(phone, code string) error {
	msg := fmt.Sprintf("Jamoa xarid tasdiqlash kodi: %s", code)
	if s.email == "" || s.password == "" {
		log.Printf("[sms:dev] %s -> %s", phone, code)
		return nil
	}
	token, err := s.bearer()
	if err != nil {
		if s.dev {
			log.Printf("[sms:fallback] %s -> %s (%v)", phone, code, err)
			return nil
		}
		return err
	}
	form := url.Values{}
	form.Set("mobile_phone", strings.TrimPrefix(phone, "+"))
	form.Set("message", msg)
	form.Set("from", s.from)
	req, err := http.NewRequest(http.MethodPost, "https://notify.eskiz.uz/api/message/sms/send", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return fmt.Errorf("eskiz sms: %s %s", res.Status, string(body))
	}
	return nil
}

func (s *Sender) bearer() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.token != "" && time.Now().Before(s.until) {
		return s.token, nil
	}
	form := url.Values{}
	form.Set("email", s.email)
	form.Set("password", s.password)
	res, err := http.PostForm("https://notify.eskiz.uz/api/auth/login", form)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("eskiz login: %s %s", res.Status, string(b))
	}
	// crude extract: "token":"..."
	token := extractJSONString(string(b), "token")
	if token == "" {
		return "", fmt.Errorf("eskiz token yo‘q")
	}
	s.token = token
	s.until = time.Now().Add(20 * 24 * time.Hour)
	return token, nil
}

func extractJSONString(s, key string) string {
	needle := `"` + key + `"`
	i := strings.Index(s, needle)
	if i < 0 {
		return ""
	}
	rest := s[i+len(needle):]
	j := strings.Index(rest, `"`)
	if j < 0 {
		return ""
	}
	rest = rest[j+1:]
	k := strings.Index(rest, `"`)
	if k < 0 {
		return ""
	}
	return rest[:k]
}
