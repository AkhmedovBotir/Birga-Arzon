package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	HTTPAddr             string
	AppEnv               string
	PublicURL            string
	DatabaseURL          string
	JWTSecret            string
	PaymentTimeout       time.Duration
	HomeDeliveryFeeUZS int64
	TelegramBotToken   string
	DefaultOTP         string
}

func Load() Config {
	_ = godotenv.Load()
	_ = godotenv.Load("backend/.env")
	hours := intEnv("PAYMENT_TIMEOUT_HOURS", 4)
	return Config{
		HTTPAddr:           env("HTTP_ADDR", ":8080"),
		AppEnv:             env("APP_ENV", "development"),
		PublicURL:          strings.TrimRight(env("PUBLIC_URL", "http://localhost:8080"), "/"),
		DatabaseURL:        databaseURL(),
		JWTSecret:          env("JWT_SECRET", "change-me-in-production"),
		PaymentTimeout:     time.Duration(hours) * time.Hour,
		HomeDeliveryFeeUZS: int64(intEnv("HOME_DELIVERY_FEE_UZS", 10000)),
		TelegramBotToken:   env("TELEGRAM_BOT_TOKEN", ""),
		DefaultOTP:         env("DEFAULT_OTP", "11111"),
	}
}

func (c Config) Dev() bool { return c.AppEnv != "production" }

func databaseURL() string {
	if v := env("DATABASE_URL", ""); v != "" {
		return v
	}
	u := url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(env("DB_USER", "postgres"), env("DB_PASSWORD", "123456")),
		Host:   fmt.Sprintf("%s:%s", env("DB_HOST", "localhost"), env("DB_PORT", "5432")),
		Path:   "/" + env("DB_NAME", "yangi"),
	}
	q := u.Query()
	q.Set("sslmode", env("DB_SSLMODE", "disable"))
	u.RawQuery = q.Encode()
	return u.String()
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func intEnv(key string, fallback int) int {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		n, err := strconv.Atoi(v)
		if err == nil {
			return n
		}
	}
	return fallback
}
