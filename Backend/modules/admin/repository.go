package admin

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound      = errors.New("admin not found")
	ErrUsernameTaken = errors.New("username already taken")
	ErrGeneralExists = errors.New("general admin already exists")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, a *Admin) error {
	const q = `
		INSERT INTO admins (
			first_name, last_name, phone, role, username, password_hash, created_by
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id, is_active, created_at, updated_at`

	err := r.db.QueryRow(ctx, q,
		a.FirstName, a.LastName, a.Phone, a.Role, a.Username, a.PasswordHash, a.CreatedBy,
	).Scan(&a.ID, &a.IsActive, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			if a.Role == RoleGeneral && strings.Contains(pgErr.ConstraintName, "general") {
				return ErrGeneralExists
			}
			return ErrUsernameTaken
		}
		return fmt.Errorf("create admin: %w", err)
	}
	return nil
}

func (r *Repository) FindByUsername(ctx context.Context, username string) (*Admin, error) {
	const q = `
		SELECT id, first_name, last_name, phone, role, username, password_hash,
		       is_active, created_by, created_at, updated_at
		FROM admins WHERE username = $1`

	a, err := scanAdmin(r.db.QueryRow(ctx, q, username))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return a, err
}

func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*Admin, error) {
	const q = `
		SELECT id, first_name, last_name, phone, role, username, password_hash,
		       is_active, created_by, created_at, updated_at
		FROM admins WHERE id = $1`

	a, err := scanAdmin(r.db.QueryRow(ctx, q, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return a, err
}

func (r *Repository) List(ctx context.Context) ([]Admin, error) {
	const q = `
		SELECT id, first_name, last_name, phone, role, username, password_hash,
		       is_active, created_by, created_at, updated_at
		FROM admins
		ORDER BY
			CASE WHEN role = 'general' THEN 0 ELSE 1 END,
			created_at ASC`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Admin
	for rows.Next() {
		a, err := scanAdmin(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *a)
	}
	return list, rows.Err()
}

func (r *Repository) CountByRole(ctx context.Context, role string) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM admins WHERE role = $1`, role).Scan(&n)
	return n, err
}

func (r *Repository) Update(ctx context.Context, a *Admin) error {
	const q = `
		UPDATE admins SET
			first_name = $2,
			last_name = $3,
			phone = $4,
			username = $5,
			password_hash = CASE WHEN $6 = '' THEN password_hash ELSE $6 END,
			is_active = $7,
			updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at`

	err := r.db.QueryRow(ctx, q,
		a.ID, a.FirstName, a.LastName, a.Phone, a.Username, a.PasswordHash, a.IsActive,
	).Scan(&a.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrUsernameTaken
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("update admin: %w", err)
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM admins WHERE id = $1 AND role = $2`, id, RoleAdmin)
	if err != nil {
		return fmt.Errorf("delete admin: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

type scannable interface {
	Scan(dest ...any) error
}

func scanAdmin(row scannable) (*Admin, error) {
	var a Admin
	err := row.Scan(
		&a.ID, &a.FirstName, &a.LastName, &a.Phone, &a.Role, &a.Username, &a.PasswordHash,
		&a.IsActive, &a.CreatedBy, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}
