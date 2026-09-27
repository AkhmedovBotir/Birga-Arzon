package dbx

import (
	"errors"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

// IsFKViolation reports Postgres foreign_key_violation (23503).
func IsFKViolation(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "23503"
}

// ConstraintName returns the FK constraint name if present.
func ConstraintName(err error) string {
	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		return pg.ConstraintName
	}
	return ""
}

// PublicError hides raw Postgres text from API clients.
func PublicError(err error, fallback string) string {
	if err == nil {
		return fallback
	}
	msg := err.Error()
	if IsFKViolation(err) ||
		strings.Contains(msg, "SQLSTATE") ||
		strings.Contains(msg, "нарушает ограничение") ||
		strings.Contains(msg, "violates foreign key") {
		if fallback != "" {
			return fallback
		}
		return "Bog‘liq ma’lumotlar bor — o‘chirib bo‘lmadi"
	}
	return msg
}
