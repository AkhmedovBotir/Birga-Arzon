package user

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"time"

	"birgaarzon/backend/internal/config"
	"birgaarzon/backend/internal/sms"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidPhone   = errors.New("invalid phone")
	ErrInvalidOTP     = errors.New("invalid or expired code")
	ErrTooManyTries   = errors.New("too many attempts")
	ErrBlocked        = errors.New("user is blocked")
	ErrResendTooSoon  = errors.New("resend too soon")
	ErrSMSNotConfigured = errors.New("sms not configured")
)

type Service struct {
	repo *Repository
	cfg  *config.Config
	sms  *sms.Client
}

func NewService(repo *Repository, cfg *config.Config, smsClient *sms.Client) *Service {
	return &Service{repo: repo, cfg: cfg, sms: smsClient}
}

type Claims struct {
	UserID string `json:"user_id"`
	Phone  string `json:"phone"`
	Typ    string `json:"typ"`
	jwt.RegisteredClaims
}

var phoneDigitsRe = regexp.MustCompile(`\D`)

// NormalizePhone accepts 9 local digits or +998… and returns +998XXXXXXXXX
func NormalizePhone(raw string) (string, error) {
	d := phoneDigitsRe.ReplaceAllString(raw, "")
	if strings.HasPrefix(d, "998") && len(d) == 12 {
		d = d[3:]
	}
	if len(d) != 9 {
		return "", ErrInvalidPhone
	}
	return "+998" + d, nil
}

func (s *Service) SendOTP(ctx context.Context, rawPhone string) error {
	phone, err := NormalizePhone(rawPhone)
	if err != nil {
		return err
	}
	if existing, findErr := s.repo.FindByPhone(ctx, phone); findErr == nil && existing.IsBlocked {
		return ErrBlocked
	}

	if s.sms == nil || !s.sms.Enabled() {
		return ErrSMSNotConfigured
	}

	resendAfter := time.Duration(s.cfg.OTPResendSeconds) * time.Second
	if resendAfter <= 0 {
		resendAfter = 60 * time.Second
	}
	if createdAt, metaErr := s.repo.GetOTPMeta(ctx, phone); metaErr == nil {
		if time.Since(createdAt) < resendAfter {
			return ErrResendTooSoon
		}
	}

	code, err := randomOTP(6)
	if err != nil {
		return err
	}

	ttlMin := s.cfg.OTPttlMinutes
	if ttlMin <= 0 {
		ttlMin = 5
	}
	expires := time.Now().Add(time.Duration(ttlMin) * time.Minute)
	if err := s.repo.UpsertOTP(ctx, phone, code, expires); err != nil {
		return err
	}

	if err := s.sms.SendOTP(ctx, phone, code); err != nil {
		return fmt.Errorf("SMS yuborilmadi: %w", err)
	}
	return nil
}

func (s *Service) VerifyOTP(ctx context.Context, rawPhone, code string) (*AuthResponse, error) {
	phone, err := NormalizePhone(rawPhone)
	if err != nil {
		return nil, err
	}
	code = strings.TrimSpace(code)
	if len(code) < 4 {
		return nil, ErrInvalidOTP
	}

	stored, expires, attempts, err := s.repo.GetOTP(ctx, phone)
	if err != nil {
		return nil, ErrInvalidOTP
	}
	if attempts >= 5 {
		return nil, ErrTooManyTries
	}
	if time.Now().After(expires) {
		_ = s.repo.DeleteOTP(ctx, phone)
		return nil, ErrInvalidOTP
	}
	if stored != code {
		_ = s.repo.IncOTPAttempts(ctx, phone)
		return nil, ErrInvalidOTP
	}
	_ = s.repo.DeleteOTP(ctx, phone)

	u, err := s.repo.FindByPhone(ctx, phone)
	if errors.Is(err, ErrNotFound) {
		u, err = s.repo.CreateStub(ctx, phone)
	}
	if err != nil {
		return nil, err
	}
	if u.IsBlocked {
		return nil, ErrBlocked
	}

	token, err := s.issueToken(u)
	if err != nil {
		return nil, err
	}
	return &AuthResponse{
		Token:        token,
		NeedsProfile: !u.ProfileComplete,
		User:         u,
	}, nil
}

func (s *Service) CompleteProfile(ctx context.Context, userID uuid.UUID, req CompleteProfileRequest) (*User, error) {
	first := strings.TrimSpace(req.FirstName)
	last := strings.TrimSpace(req.LastName)
	if first == "" || last == "" {
		return nil, errors.New("ism va familiya majburiy")
	}
	if req.ViloyatID == uuid.Nil || req.TumanID == uuid.Nil {
		return nil, errors.New("viloyat va tuman tanlang")
	}
	if req.Lat < -90 || req.Lat > 90 || req.Lng < -180 || req.Lng > 180 {
		return nil, errors.New("lokatsiya noto‘g‘ri")
	}
	if req.Lat < 37 || req.Lat > 46 || req.Lng < 55 || req.Lng > 74 {
		return nil, errors.New("lokatsiya O‘zbekiston hududida bo‘lishi kerak")
	}

	ok, err := s.repo.RegionIsActive(ctx, req.ViloyatID, "viloyat", nil)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("viloyat topilmadi")
	}
	ok, err = s.repo.RegionIsActive(ctx, req.TumanID, "tuman", &req.ViloyatID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("tuman topilmadi")
	}

	return s.repo.CompleteProfile(ctx, userID, first, last, req.ViloyatID, req.TumanID, req.Lat, req.Lng)
}

func (s *Service) Me(ctx context.Context, id uuid.UUID) (*User, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *Service) issueToken(u *User) (string, error) {
	claims := Claims{
		UserID: u.ID.String(),
		Phone:  u.Phone,
		Typ:    "user",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(s.cfg.JWTExpiresHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(s.cfg.JWTSecret))
}

func (s *Service) ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid || claims.Typ != "user" {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func randomOTP(n int) (string, error) {
	var b strings.Builder
	for i := 0; i < n; i++ {
		v, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		b.WriteByte(byte('0' + v.Int64()))
	}
	return b.String(), nil
}
