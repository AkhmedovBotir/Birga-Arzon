package product

import (
	"context"
	"encoding/json"
	"fmt"

	"birgaarzon/backend/internal/dbx"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func IsNoRows(err error) bool {
	return err == pgx.ErrNoRows
}

func (r *Repository) Stats(ctx context.Context) (Stats, error) {
	var s Stats
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'active'),
			COUNT(*) FILTER (WHERE status = 'inactive')
		FROM products`).Scan(&s.Total, &s.Active, &s.Inactive)
	return s, err
}

func (r *Repository) List(ctx context.Context, q string) ([]ProductListItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT p.id, p.category_id, p.subcategory_id, p.name, p.unit, p.unit_size::float8,
			p.stock, p.price, p.images, p.status,
			c.name, s.name, p.created_at, p.updated_at
		FROM products p
		JOIN categories c ON c.id = p.category_id
		JOIN subcategories s ON s.id = p.subcategory_id
		WHERE ($1 = '' OR p.name ILIKE '%' || $1 || '%' OR c.name ILIKE '%' || $1 || '%' OR s.name ILIKE '%' || $1 || '%')
		ORDER BY p.created_at DESC`, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ProductListItem
	for rows.Next() {
		var item ProductListItem
		if err := rows.Scan(
			&item.ID, &item.CategoryID, &item.SubcategoryID, &item.Name, &item.Unit, &item.UnitSize,
			&item.Stock, &item.Price, &item.Images, &item.Status,
			&item.CategoryName, &item.SubcategoryName, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if item.Images == nil {
			item.Images = []string{}
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func (r *Repository) Get(ctx context.Context, id uuid.UUID) (*Product, error) {
	var p Product
	var desc []byte
	err := r.db.QueryRow(ctx, `
		SELECT p.id, p.category_id, p.subcategory_id, p.name, p.description, p.unit, p.unit_size::float8,
			p.stock, p.price, p.images, p.status, p.created_at, p.updated_at,
			c.name, s.name
		FROM products p
		JOIN categories c ON c.id = p.category_id
		JOIN subcategories s ON s.id = p.subcategory_id
		WHERE p.id = $1`, id,
	).Scan(
		&p.ID, &p.CategoryID, &p.SubcategoryID, &p.Name, &desc, &p.Unit, &p.UnitSize,
		&p.Stock, &p.Price, &p.Images, &p.Status, &p.CreatedAt, &p.UpdatedAt,
		&p.CategoryName, &p.SubcategoryName,
	)
	if err != nil {
		return nil, err
	}
	p.Description = json.RawMessage(desc)
	if p.Images == nil {
		p.Images = []string{}
	}
	return &p, nil
}

func (r *Repository) SubcategoryBelongs(ctx context.Context, categoryID, subcategoryID uuid.UUID) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM subcategories WHERE id = $1 AND category_id = $2
		)`, subcategoryID, categoryID).Scan(&ok)
	return ok, err
}

func (r *Repository) Create(ctx context.Context, p *Product) error {
	desc := p.Description
	if len(desc) == 0 {
		desc = json.RawMessage(`{"ops":[{"insert":"\n"}]}`)
	}
	return r.db.QueryRow(ctx, `
		INSERT INTO products (
			category_id, subcategory_id, name, description, unit, unit_size,
			stock, price, images, status
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING id, created_at, updated_at`,
		p.CategoryID, p.SubcategoryID, p.Name, desc, p.Unit, p.UnitSize,
		p.Stock, p.Price, p.Images, p.Status,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *Repository) Update(ctx context.Context, id uuid.UUID, p *Product) (*Product, error) {
	desc := p.Description
	if len(desc) == 0 {
		desc = json.RawMessage(`{"ops":[{"insert":"\n"}]}`)
	}
	var out Product
	var raw []byte
	err := r.db.QueryRow(ctx, `
		UPDATE products SET
			category_id=$2, subcategory_id=$3, name=$4, description=$5, unit=$6, unit_size=$7,
			stock=$8, price=$9, images=$10, status=$11, updated_at=NOW()
		WHERE id=$1
		RETURNING id, category_id, subcategory_id, name, description, unit, unit_size::float8,
			stock, price, images, status, created_at, updated_at`,
		id, p.CategoryID, p.SubcategoryID, p.Name, desc, p.Unit, p.UnitSize,
		p.Stock, p.Price, p.Images, p.Status,
	).Scan(
		&out.ID, &out.CategoryID, &out.SubcategoryID, &out.Name, &raw, &out.Unit, &out.UnitSize,
		&out.Stock, &out.Price, &out.Images, &out.Status, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	out.Description = json.RawMessage(raw)
	if out.Images == nil {
		out.Images = []string{}
	}
	return &out, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) (*Product, error) {
	var out Product
	var raw []byte
	err := r.db.QueryRow(ctx, `
		UPDATE products SET status=$2, updated_at=NOW()
		WHERE id=$1
		RETURNING id, category_id, subcategory_id, name, description, unit, unit_size::float8,
			stock, price, images, status, created_at, updated_at`,
		id, status,
	).Scan(
		&out.ID, &out.CategoryID, &out.SubcategoryID, &out.Name, &raw, &out.Unit, &out.UnitSize,
		&out.Stock, &out.Price, &out.Images, &out.Status, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	out.Description = json.RawMessage(raw)
	if out.Images == nil {
		out.Images = []string{}
	}
	return &out, nil
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM products WHERE id=$1`, id)
	if err != nil {
		if dbx.IsFKViolation(err) {
			_, err2 := r.UpdateStatus(ctx, id, "inactive")
			return err2
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("not found")
	}
	return nil
}
