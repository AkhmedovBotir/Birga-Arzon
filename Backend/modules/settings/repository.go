package settings

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const KeyMinOrderAmount = "min_order_amount"
const KeyDeliveryFee = "delivery_fee"
const KeyTelegramBotToken = "telegram_bot_token"
const KeyTelegramWebappURL = "telegram_webapp_url"

type Settings struct {
	MinOrderAmount   float64   `json:"min_order_amount"`
	DeliveryFee      float64   `json:"delivery_fee"`
	TelegramBotToken string    `json:"telegram_bot_token"`
	TelegramWebappURL string   `json:"telegram_webapp_url"`
	UpdatedAt        time.Time `json:"updated_at,omitempty"`
}

type UpdateRequest struct {
	MinOrderAmount    *float64 `json:"min_order_amount"`
	DeliveryFee       *float64 `json:"delivery_fee"`
	TelegramBotToken  *string  `json:"telegram_bot_token"`
	TelegramWebappURL *string  `json:"telegram_webapp_url"`
}

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Get(ctx context.Context) (*Settings, error) {
	rows, err := r.db.Query(ctx, `
		SELECT key, value, updated_at
		FROM app_settings
		WHERE key IN ($1, $2, $3, $4)
	`, KeyMinOrderAmount, KeyDeliveryFee, KeyTelegramBotToken, KeyTelegramWebappURL)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := &Settings{MinOrderAmount: 0, DeliveryFee: 0, TelegramWebappURL: "https://birgaarzon.uz"}
	var latest time.Time
	for rows.Next() {
		var key, value string
		var updated time.Time
		if err := rows.Scan(&key, &value, &updated); err != nil {
			return nil, err
		}
		switch key {
		case KeyMinOrderAmount:
			out.MinOrderAmount = parseAmount(value)
		case KeyDeliveryFee:
			out.DeliveryFee = parseAmount(value)
		case KeyTelegramBotToken:
			out.TelegramBotToken = strings.TrimSpace(value)
		case KeyTelegramWebappURL:
			if v := strings.TrimSpace(value); v != "" {
				out.TelegramWebappURL = v
			}
		}
		if updated.After(latest) {
			latest = updated
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out.UpdatedAt = latest
	return out, nil
}

func (r *Repository) MinOrderAmount(ctx context.Context) (float64, error) {
	return r.getAmount(ctx, KeyMinOrderAmount)
}

func (r *Repository) DeliveryFee(ctx context.Context) (float64, error) {
	return r.getAmount(ctx, KeyDeliveryFee)
}

func (r *Repository) getAmount(ctx context.Context, key string) (float64, error) {
	var value string
	err := r.db.QueryRow(ctx, `
		SELECT value FROM app_settings WHERE key = $1
	`, key).Scan(&value)
	if err != nil {
		if err == pgx.ErrNoRows {
			return 0, nil
		}
		return 0, err
	}
	return parseAmount(value), nil
}

func (r *Repository) SetMinOrderAmount(ctx context.Context, amount float64) (*Settings, error) {
	if err := r.setAmount(ctx, KeyMinOrderAmount, amount); err != nil {
		return nil, err
	}
	return r.Get(ctx)
}

func (r *Repository) SetDeliveryFee(ctx context.Context, amount float64) (*Settings, error) {
	if err := r.setAmount(ctx, KeyDeliveryFee, amount); err != nil {
		return nil, err
	}
	return r.Get(ctx)
}

func (r *Repository) TelegramBotToken(ctx context.Context) (string, error) {
	return r.getString(ctx, KeyTelegramBotToken)
}

func (r *Repository) TelegramWebappURL(ctx context.Context) (string, error) {
	val, err := r.getString(ctx, KeyTelegramWebappURL)
	if err != nil || val == "" {
		return "https://birgaarzon.uz", nil
	}
	return val, nil
}

func (r *Repository) getString(ctx context.Context, key string) (string, error) {
	var value string
	err := r.db.QueryRow(ctx, `
		SELECT value FROM app_settings WHERE key = $1
	`, key).Scan(&value)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", nil
		}
		return "", err
	}
	return strings.TrimSpace(value), nil
}

func (r *Repository) SetTelegramBotToken(ctx context.Context, token string) (*Settings, error) {
	if err := r.setString(ctx, KeyTelegramBotToken, token); err != nil {
		return nil, err
	}
	return r.Get(ctx)
}

func (r *Repository) SetTelegramWebappURL(ctx context.Context, url string) (*Settings, error) {
	if err := r.setString(ctx, KeyTelegramWebappURL, url); err != nil {
		return nil, err
	}
	return r.Get(ctx)
}

func (r *Repository) Update(ctx context.Context, req UpdateRequest) (*Settings, error) {
	if req.MinOrderAmount != nil {
		if err := r.setAmount(ctx, KeyMinOrderAmount, *req.MinOrderAmount); err != nil {
			return nil, err
		}
	}
	if req.DeliveryFee != nil {
		if err := r.setAmount(ctx, KeyDeliveryFee, *req.DeliveryFee); err != nil {
			return nil, err
		}
	}
	if req.TelegramBotToken != nil {
		if err := r.setString(ctx, KeyTelegramBotToken, *req.TelegramBotToken); err != nil {
			return nil, err
		}
	}
	if req.TelegramWebappURL != nil {
		if err := r.setString(ctx, KeyTelegramWebappURL, *req.TelegramWebappURL); err != nil {
			return nil, err
		}
	}
	return r.Get(ctx)
}

func (r *Repository) setString(ctx context.Context, key, val string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO app_settings (key, value, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (key) DO UPDATE
		SET value = EXCLUDED.value, updated_at = NOW()
	`, key, strings.TrimSpace(val))
	return err
}

func (r *Repository) setAmount(ctx context.Context, key string, amount float64) error {
	if amount < 0 {
		amount = 0
	}
	value := strconv.FormatFloat(amount, 'f', -1, 64)
	_, err := r.db.Exec(ctx, `
		INSERT INTO app_settings (key, value, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (key) DO UPDATE
		SET value = EXCLUDED.value, updated_at = NOW()
	`, key, value)
	return err
}

func parseAmount(v string) float64 {
	v = strings.TrimSpace(strings.ReplaceAll(v, ",", "."))
	if v == "" {
		return 0
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil || f < 0 {
		return 0
	}
	return f
}
