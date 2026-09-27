package kuryer

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"birgaarzon/backend/internal/dbx"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("kuryer not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const selectCols = `
	k.id, k.first_name, k.last_name, k.phone, k.password_hash,
	k.viloyat_id, k.tuman_id, k.is_active, k.created_at, k.updated_at,
	COALESCE(v.name, ''), COALESCE(t.name, '')`

func scanKuryer(row pgx.Row) (*Kuryer, error) {
	var k Kuryer
	err := row.Scan(
		&k.ID, &k.FirstName, &k.LastName, &k.Phone, &k.PasswordHash,
		&k.ViloyatID, &k.TumanID, &k.IsActive, &k.CreatedAt, &k.UpdatedAt,
		&k.ViloyatName, &k.TumanName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return k.WithFullName(), nil
}

func (r *Repository) Stats(ctx context.Context) (Stats, error) {
	var s Stats
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE is_active),
			COUNT(*) FILTER (WHERE NOT is_active)
		FROM kuryers`).Scan(&s.Total, &s.Active, &s.Inactive)
	return s, err
}

func (r *Repository) List(ctx context.Context, q string) ([]Kuryer, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+selectCols+`
		FROM kuryers k
		LEFT JOIN regions v ON v.id = k.viloyat_id
		LEFT JOIN regions t ON t.id = k.tuman_id
		WHERE (
			$1 = '' OR k.first_name ILIKE '%' || $1 || '%'
			OR k.last_name ILIKE '%' || $1 || '%'
			OR k.phone ILIKE '%' || $1 || '%'
			OR COALESCE(v.name, '') ILIKE '%' || $1 || '%'
			OR COALESCE(t.name, '') ILIKE '%' || $1 || '%'
		)
		ORDER BY k.created_at DESC`, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Kuryer
	for rows.Next() {
		var k Kuryer
		if err := rows.Scan(
			&k.ID, &k.FirstName, &k.LastName, &k.Phone, &k.PasswordHash,
			&k.ViloyatID, &k.TumanID, &k.IsActive, &k.CreatedAt, &k.UpdatedAt,
			&k.ViloyatName, &k.TumanName,
		); err != nil {
			return nil, err
		}
		k.WithFullName()
		list = append(list, k)
	}
	return list, rows.Err()
}

func (r *Repository) Get(ctx context.Context, id uuid.UUID) (*Kuryer, error) {
	return scanKuryer(r.db.QueryRow(ctx, `
		SELECT `+selectCols+`
		FROM kuryers k
		LEFT JOIN regions v ON v.id = k.viloyat_id
		LEFT JOIN regions t ON t.id = k.tuman_id
		WHERE k.id = $1`, id))
}

func (r *Repository) FindByPhone(ctx context.Context, phone string) (*Kuryer, error) {
	return scanKuryer(r.db.QueryRow(ctx, `
		SELECT `+selectCols+`
		FROM kuryers k
		LEFT JOIN regions v ON v.id = k.viloyat_id
		LEFT JOIN regions t ON t.id = k.tuman_id
		WHERE k.phone = $1`, phone))
}

func (r *Repository) Create(ctx context.Context, k *Kuryer) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO kuryers (
			first_name, last_name, phone, password_hash,
			viloyat_id, tuman_id, is_active
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id, created_at, updated_at`,
		k.FirstName, k.LastName, k.Phone, k.PasswordHash,
		k.ViloyatID, k.TumanID, k.IsActive,
	).Scan(&k.ID, &k.CreatedAt, &k.UpdatedAt)
}

func (r *Repository) Update(ctx context.Context, id uuid.UUID, k *Kuryer, updatePassword bool) error {
	var err error
	var n int64
	if updatePassword {
		ct, e := r.db.Exec(ctx, `
			UPDATE kuryers SET
				first_name=$2, last_name=$3, phone=$4, password_hash=$5,
				viloyat_id=$6, tuman_id=$7, is_active=$8, updated_at=NOW()
			WHERE id=$1`,
			id, k.FirstName, k.LastName, k.Phone, k.PasswordHash,
			k.ViloyatID, k.TumanID, k.IsActive,
		)
		err = e
		if e == nil {
			n = ct.RowsAffected()
		}
	} else {
		ct, e := r.db.Exec(ctx, `
			UPDATE kuryers SET
				first_name=$2, last_name=$3, phone=$4,
				viloyat_id=$5, tuman_id=$6, is_active=$7, updated_at=NOW()
			WHERE id=$1`,
			id, k.FirstName, k.LastName, k.Phone,
			k.ViloyatID, k.TumanID, k.IsActive,
		)
		err = e
		if e == nil {
			n = ct.RowsAffected()
		}
	}
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) SetActive(ctx context.Context, id uuid.UUID, active bool) (*Kuryer, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE kuryers SET is_active=$2, updated_at=NOW() WHERE id=$1`, id, active)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return r.Get(ctx, id)
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM kuryers WHERE id=$1`, id)
	if err != nil {
		if dbx.IsFKViolation(err) {
			_, err2 := r.SetActive(ctx, id, false)
			return err2
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) RegionExists(ctx context.Context, id uuid.UUID, typ string) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM regions WHERE id=$1 AND type=$2 AND status='active')`,
		id, typ,
	).Scan(&ok)
	return ok, err
}

func NormalizePhone(raw string) (string, error) {
	d := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, raw)
	if strings.HasPrefix(d, "998") && len(d) == 12 {
		return d, nil
	}
	if len(d) == 9 {
		return "998" + d, nil
	}
	return "", fmt.Errorf("telefon raqam noto‘g‘ri")
}
