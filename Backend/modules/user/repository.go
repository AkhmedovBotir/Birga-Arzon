package user

import (
	"context"
	"errors"
	"strings"
	"time"

	"birgaarzon/backend/internal/dbx"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) UpsertOTP(ctx context.Context, phone, code string, expiresAt time.Time) error {
	const q = `
		INSERT INTO user_otps (phone, code, expires_at, attempts, created_at)
		VALUES ($1, $2, $3, 0, NOW())
		ON CONFLICT (phone) DO UPDATE
		SET code = EXCLUDED.code,
		    expires_at = EXCLUDED.expires_at,
		    attempts = 0,
		    created_at = NOW()`
	_, err := r.db.Exec(ctx, q, phone, code, expiresAt)
	return err
}

func (r *Repository) GetOTPMeta(ctx context.Context, phone string) (createdAt time.Time, err error) {
	const q = `SELECT created_at FROM user_otps WHERE phone = $1`
	err = r.db.QueryRow(ctx, q, phone).Scan(&createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, ErrNotFound
	}
	return
}

func (r *Repository) GetOTP(ctx context.Context, phone string) (code string, expiresAt time.Time, attempts int, err error) {
	const q = `SELECT code, expires_at, attempts FROM user_otps WHERE phone = $1`
	err = r.db.QueryRow(ctx, q, phone).Scan(&code, &expiresAt, &attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", time.Time{}, 0, ErrNotFound
	}
	return
}

func (r *Repository) IncOTPAttempts(ctx context.Context, phone string) error {
	_, err := r.db.Exec(ctx, `UPDATE user_otps SET attempts = attempts + 1 WHERE phone = $1`, phone)
	return err
}

func (r *Repository) DeleteOTP(ctx context.Context, phone string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM user_otps WHERE phone = $1`, phone)
	return err
}

func scanUser(row pgx.Row) (*User, error) {
	var u User
	err := row.Scan(
		&u.ID, &u.Phone, &u.FirstName, &u.LastName, &u.FullName,
		&u.ViloyatID, &u.TumanID, &u.Lat, &u.Lng, &u.ProfileComplete, &u.IsBlocked,
		&u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

const userCols = `
	id, phone, first_name, last_name, full_name,
	viloyat_id, tuman_id, lat, lng, profile_complete, is_blocked,
	created_at, updated_at`

func (r *Repository) FindByPhone(ctx context.Context, phone string) (*User, error) {
	return scanUser(r.db.QueryRow(ctx, `SELECT `+userCols+` FROM user_profiles WHERE phone = $1`, phone))
}

func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*User, error) {
	return scanUser(r.db.QueryRow(ctx, `SELECT `+userCols+` FROM user_profiles WHERE id = $1`, id))
}

func (r *Repository) CreateStub(ctx context.Context, phone string) (*User, error) {
	const q = `
		INSERT INTO user_profiles (phone, full_name, profile_complete)
		VALUES ($1, '', FALSE)
		RETURNING ` + userCols
	return scanUser(r.db.QueryRow(ctx, q, phone))
}

func (r *Repository) CompleteProfile(ctx context.Context, id uuid.UUID, first, last string, viloyatID, tumanID uuid.UUID, lat, lng float64) (*User, error) {
	full := first
	if last != "" {
		full = first + " " + last
	}
	const q = `
		UPDATE user_profiles SET
			first_name = $2,
			last_name = $3,
			full_name = $4,
			viloyat_id = $5,
			tuman_id = $6,
			lat = $7,
			lng = $8,
			profile_complete = TRUE,
			updated_at = NOW()
		WHERE id = $1
		RETURNING ` + userCols
	return scanUser(r.db.QueryRow(ctx, q, id, first, last, full, viloyatID, tumanID, lat, lng))
}

func (r *Repository) RegionIsActive(ctx context.Context, id uuid.UUID, typ string, parentID *uuid.UUID) (bool, error) {
	var status string
	var gotParent *uuid.UUID
	var gotType string
	err := r.db.QueryRow(ctx, `
		SELECT status, type, parent_id FROM regions WHERE id = $1`, id,
	).Scan(&status, &gotType, &gotParent)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if status != "active" || gotType != typ {
		return false, nil
	}
	if parentID != nil {
		if gotParent == nil || *gotParent != *parentID {
			return false, nil
		}
	}
	return true, nil
}

type AdminUserRow struct {
	User
	ViloyatName *string `json:"viloyat_name,omitempty"`
	TumanName   *string `json:"tuman_name,omitempty"`
}

func (r *Repository) List(ctx context.Context) ([]AdminUserRow, error) {
	const q = `
		SELECT
			u.id, u.phone, u.first_name, u.last_name, u.full_name,
			u.viloyat_id, u.tuman_id, u.lat, u.lng, u.profile_complete, u.is_blocked,
			u.created_at, u.updated_at,
			v.name AS viloyat_name,
			t.name AS tuman_name
		FROM user_profiles u
		LEFT JOIN regions v ON v.id = u.viloyat_id
		LEFT JOIN regions t ON t.id = u.tuman_id
		ORDER BY u.created_at DESC`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]AdminUserRow, 0)
	for rows.Next() {
		var row AdminUserRow
		if err := rows.Scan(
			&row.ID, &row.Phone, &row.FirstName, &row.LastName, &row.FullName,
			&row.ViloyatID, &row.TumanID, &row.Lat, &row.Lng, &row.ProfileComplete, &row.IsBlocked,
			&row.CreatedAt, &row.UpdatedAt,
			&row.ViloyatName, &row.TumanName,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) CreateFull(
	ctx context.Context,
	phone, first, last string,
	viloyatID, tumanID *uuid.UUID,
	lat, lng *float64,
	profileComplete bool,
	isBlocked bool,
) (*User, error) {
	full := strings.TrimSpace(first + " " + last)
	const q = `
		INSERT INTO user_profiles (
			phone, first_name, last_name, full_name,
			viloyat_id, tuman_id, lat, lng, profile_complete, is_blocked
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING ` + userCols
	return scanUser(r.db.QueryRow(ctx, q,
		phone, first, last, full,
		viloyatID, tumanID, lat, lng, profileComplete, isBlocked,
	))
}

func (r *Repository) UpdateByAdmin(
	ctx context.Context,
	id uuid.UUID,
	phone, first, last string,
	viloyatID, tumanID *uuid.UUID,
	lat, lng *float64,
	profileComplete bool,
	isBlocked bool,
) (*User, error) {
	full := strings.TrimSpace(first + " " + last)
	const q = `
		UPDATE user_profiles SET
			phone = $2,
			first_name = $3,
			last_name = $4,
			full_name = $5,
			viloyat_id = $6,
			tuman_id = $7,
			lat = $8,
			lng = $9,
			profile_complete = $10,
			is_blocked = $11,
			updated_at = NOW()
		WHERE id = $1
		RETURNING ` + userCols
	return scanUser(r.db.QueryRow(ctx, q,
		id, phone, first, last, full,
		viloyatID, tumanID, lat, lng, profileComplete, isBlocked,
	))
}

func (r *Repository) SetBlocked(ctx context.Context, id uuid.UUID, blocked bool) (*User, error) {
	const q = `
		UPDATE user_profiles SET is_blocked = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING ` + userCols
	return scanUser(r.db.QueryRow(ctx, q, id, blocked))
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	// Buyurtma tarixi bo‘lsa — hard delete o‘rniga bloklaymiz (CASCADE tarixni o‘chiradi)
	var hasOrders bool
	if err := r.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM orders WHERE user_id = $1)`, id,
	).Scan(&hasOrders); err != nil {
		return err
	}
	if hasOrders {
		_, err := r.SetBlocked(ctx, id, true)
		return err
	}

	tag, err := r.db.Exec(ctx, `DELETE FROM user_profiles WHERE id = $1`, id)
	if err != nil {
		if dbx.IsFKViolation(err) {
			_, err2 := r.SetBlocked(ctx, id, true)
			return err2
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) PhoneExists(ctx context.Context, phone string, excludeID *uuid.UUID) (bool, error) {
	var n int
	var err error
	if excludeID != nil {
		err = r.db.QueryRow(ctx,
			`SELECT COUNT(*) FROM user_profiles WHERE phone = $1 AND id <> $2`,
			phone, *excludeID,
		).Scan(&n)
	} else {
		err = r.db.QueryRow(ctx,
			`SELECT COUNT(*) FROM user_profiles WHERE phone = $1`, phone,
		).Scan(&n)
	}
	return n > 0, err
}
