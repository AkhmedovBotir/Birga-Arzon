package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppName            string
	AppEnv             string
	HTTPHost           string
	HTTPPort           string
	DBHost             string
	DBPort             string
	DBUser             string
	DBPassword         string
	DBName             string
	DBSSLMode          string
	DBMaxConns         int32
	DBMinConns         int32
	MigrateDir         string
	MigrateLockTimeout time.Duration
	JWTSecret          string
	JWTExpiresHours    int

	EskizEmail       string
	EskizPassword    string
	EskizFrom        string
	OTPttlMinutes    int
	OTPResendSeconds int

	AtmosConsumerKey    string
	AtmosConsumerSecret string
	AtmosStoreID        string
	AtmosAPIKey         string
	AtmosBaseURL        string
	AtmosCheckoutURL    string
	FrontendURL         string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	maxConns, err := strconv.Atoi(getEnv("DB_MAX_CONNS", "20"))
	if err != nil {
		return nil, fmt.Errorf("DB_MAX_CONNS: %w", err)
	}
	minConns, err := strconv.Atoi(getEnv("DB_MIN_CONNS", "2"))
	if err != nil {
		return nil, fmt.Errorf("DB_MIN_CONNS: %w", err)
	}

	lockTimeout, err := time.ParseDuration(getEnv("MIGRATE_LOCK_TIMEOUT", "15s"))
	if err != nil {
		return nil, fmt.Errorf("MIGRATE_LOCK_TIMEOUT: %w", err)
	}

	jwtHours, err := strconv.Atoi(getEnv("JWT_EXPIRES_HOURS", "72"))
	if err != nil {
		return nil, fmt.Errorf("JWT_EXPIRES_HOURS: %w", err)
	}

	otpTTL, err := strconv.Atoi(getEnv("OTP_TTL_MINUTES", "5"))
	if err != nil {
		return nil, fmt.Errorf("OTP_TTL_MINUTES: %w", err)
	}
	otpResend, err := strconv.Atoi(getEnv("OTP_RESEND_SECONDS", "60"))
	if err != nil {
		return nil, fmt.Errorf("OTP_RESEND_SECONDS: %w", err)
	}

	cfg := &Config{
		AppName:            getEnv("APP_NAME", "Birga Arzon API"),
		AppEnv:             getEnv("APP_ENV", "development"),
		HTTPHost:           getEnv("HTTP_HOST", "0.0.0.0"),
		HTTPPort:           getEnv("HTTP_PORT", "8080"),
		DBHost:             getEnv("DB_HOST", "127.0.0.1"),
		DBPort:             getEnv("DB_PORT", "5432"),
		DBUser:             getEnv("DB_USER", "birga"),
		DBPassword:         getEnv("DB_PASSWORD", "birga_secret"),
		DBName:             getEnv("DB_NAME", "birga_arzon"),
		DBSSLMode:          getEnv("DB_SSLMODE", "disable"),
		DBMaxConns:         int32(maxConns),
		DBMinConns:         int32(minConns),
		MigrateDir:         getEnv("MIGRATE_DIR", "migrations"),
		MigrateLockTimeout: lockTimeout,
		JWTSecret:          getEnv("JWT_SECRET", "birga-arzon-dev-secret-change-me"),
		JWTExpiresHours:    jwtHours,
		EskizEmail:         getEnv("ESKIZ_EMAIL", ""),
		EskizPassword:      getEnv("ESKIZ_PASSWORD", ""),
		EskizFrom:          getEnv("ESKIZ_FROM", "4546"),
		OTPttlMinutes:      otpTTL,
		OTPResendSeconds:   otpResend,
		AtmosConsumerKey:    getEnv("ATMOS_CONSUMER_KEY", ""),
		AtmosConsumerSecret: getEnv("ATMOS_CONSUMER_SECRET", ""),
		AtmosStoreID:        getEnv("ATMOS_STORE_ID", ""),
		AtmosAPIKey:         getEnv("ATMOS_API_KEY", ""),
		AtmosBaseURL:        strings.TrimRight(getEnv("ATMOS_BASE_URL", "https://apigw.atmos.uz"), "/"),
		AtmosCheckoutURL:    strings.TrimRight(getEnv("ATMOS_CHECKOUT_URL", "https://checkout.atmos.uz"), "/"),
		FrontendURL:         strings.TrimRight(getEnv("FRONTEND_URL", "https://birgaarzon.uz"), "/"),
	}

	return cfg, nil
}

func (c *Config) DatabaseURL() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName, c.DBSSLMode,
	)
}

func (c *Config) MaintenanceDatabaseURL(maintenanceDB string) string {
	if maintenanceDB == "" {
		maintenanceDB = "postgres"
	}
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, maintenanceDB, c.DBSSLMode,
	)
}

func (c *Config) Addr() string {
	return fmt.Sprintf("%s:%s", c.HTTPHost, c.HTTPPort)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
