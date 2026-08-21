package authkit

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type Claims struct {
	UserID string `json:"uid"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func HashPassword(pw string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pw), 12)
	return string(b), err
}

func CheckPassword(hash, pw string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
}

func SignToken(secret, userID, role string) (string, error) {
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

func ParseToken(secret, token string) (*Claims, error) {
	t, err := jwt.ParseWithClaims(token, &Claims{}, func(t *jwt.Token) (any, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	c, ok := t.Claims.(*Claims)
	if !ok || !t.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return c, nil
}

func HashOTP(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

func RandomDigits(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	out := make([]byte, n)
	for i := 0; i < n; i++ {
		out[i] = '0' + (b[i] % 10)
	}
	return string(out), nil
}

func NormalizeUZPhone(raw string) (string, error) {
	d := make([]rune, 0, 12)
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			d = append(d, r)
		}
	}
	s := string(d)
	if strings.HasPrefix(s, "998") && len(s) == 12 {
		return "+" + s, nil
	}
	if len(s) == 9 {
		return "+998" + s, nil
	}
	return "", fmt.Errorf("telefon formati noto‘g‘ri")
}

func MaskPhone(phone string) string {
	d := make([]rune, 0, 12)
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			d = append(d, r)
		}
	}
	s := string(d)
	if len(s) < 4 {
		return "***"
	}
	return "+998 " + s[len(s)-9:len(s)-7] + " *** ** " + s[len(s)-2:]
}

func ParseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}

func MustInt(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}
