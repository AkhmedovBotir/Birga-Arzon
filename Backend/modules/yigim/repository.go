package yigim

import (
	"context"
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

func IsNoRows(err error) bool { return err == pgx.ErrNoRows }

func (r *Repository) Stats(ctx context.Context) (Stats, error) {
	var s Stats
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE type = 'single'),
			COUNT(*) FILTER (WHERE type = 'combo'),
			COUNT(*) FILTER (WHERE status = 'active'),
			COUNT(*) FILTER (WHERE status = 'inactive')
		FROM yigims`).Scan(&s.Total, &s.Single, &s.Combo, &s.Open, &s.Closed)
	return s, err
}

func (r *Repository) List(ctx context.Context, q string) ([]Yigim, error) {
	rows, err := r.db.Query(ctx, `
		SELECT y.id, y.type, y.name, y.product_id, y.target_qty, y.current_qty, y.images, y.status,
			y.created_at, y.updated_at, COALESCE(p.name, '')
		FROM yigims y
		LEFT JOIN products p ON p.id = y.product_id
		WHERE (
			$1 = '' OR y.name ILIKE '%' || $1 || '%' OR p.name ILIKE '%' || $1 || '%'
			OR EXISTS (
				SELECT 1 FROM yigim_items yi
				JOIN products pp ON pp.id = yi.product_id
				WHERE yi.yigim_id = y.id AND pp.name ILIKE '%' || $1 || '%'
			)
		)
		ORDER BY y.created_at DESC`, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Yigim
	var ids []uuid.UUID
	for rows.Next() {
		var y Yigim
		if err := rows.Scan(
			&y.ID, &y.Type, &y.Name, &y.ProductID, &y.TargetQty, &y.CurrentQty, &y.Images, &y.Status,
			&y.CreatedAt, &y.UpdatedAt, &y.ProductName,
		); err != nil {
			return nil, err
		}
		if y.Images == nil {
			y.Images = []string{}
		}
		y.Items = []YigimItem{}
		list = append(list, y)
		ids = append(ids, y.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return list, nil
	}

	itemsBy, err := r.loadItems(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range list {
		if items, ok := itemsBy[list[i].ID]; ok {
			list[i].Items = items
		}
	}
	return list, nil
}

func (r *Repository) loadItems(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID][]YigimItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT yi.id, yi.yigim_id, yi.product_id, yi.qty, p.name,
			COALESCE(p.images[1], '')
		FROM yigim_items yi
		JOIN products p ON p.id = yi.product_id
		WHERE yi.yigim_id = ANY($1)
		ORDER BY p.name ASC`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[uuid.UUID][]YigimItem{}
	for rows.Next() {
		var item YigimItem
		var yid uuid.UUID
		if err := rows.Scan(&item.ID, &yid, &item.ProductID, &item.Qty, &item.ProductName, &item.ProductImage); err != nil {
			return nil, err
		}
		out[yid] = append(out[yid], item)
	}
	return out, rows.Err()
}

func (r *Repository) Get(ctx context.Context, id uuid.UUID) (*Yigim, error) {
	var y Yigim
	err := r.db.QueryRow(ctx, `
		SELECT y.id, y.type, y.name, y.product_id, y.target_qty, y.current_qty, y.images, y.status,
			y.created_at, y.updated_at, COALESCE(p.name, '')
		FROM yigims y
		LEFT JOIN products p ON p.id = y.product_id
		WHERE y.id = $1`, id,
	).Scan(
		&y.ID, &y.Type, &y.Name, &y.ProductID, &y.TargetQty, &y.CurrentQty, &y.Images, &y.Status,
		&y.CreatedAt, &y.UpdatedAt, &y.ProductName,
	)
	if err != nil {
		return nil, err
	}
	if y.Images == nil {
		y.Images = []string{}
	}
	itemsBy, err := r.loadItems(ctx, []uuid.UUID{id})
	if err != nil {
		return nil, err
	}
	y.Items = itemsBy[id]
	if y.Items == nil {
		y.Items = []YigimItem{}
	}
	return &y, nil
}

func (r *Repository) ProductExists(ctx context.Context, id uuid.UUID) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM products WHERE id=$1)`, id).Scan(&ok)
	return ok, err
}

func (r *Repository) Create(ctx context.Context, y *Yigim, items []YigimItem) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `
		INSERT INTO yigims (type, name, product_id, target_qty, current_qty, images, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id, created_at, updated_at`,
		y.Type, y.Name, y.ProductID, y.TargetQty, y.CurrentQty, y.Images, y.Status,
	).Scan(&y.ID, &y.CreatedAt, &y.UpdatedAt)
	if err != nil {
		return err
	}

	for _, it := range items {
		if _, err := tx.Exec(ctx, `
			INSERT INTO yigim_items (yigim_id, product_id, qty)
			VALUES ($1,$2,$3)`, y.ID, it.ProductID, it.Qty); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Repository) Update(ctx context.Context, id uuid.UUID, y *Yigim, items []YigimItem) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE yigims SET type=$2, name=$3, product_id=$4, target_qty=$5, current_qty=$6, images=$7, status=$8, updated_at=NOW()
		WHERE id=$1`,
		id, y.Type, y.Name, y.ProductID, y.TargetQty, y.CurrentQty, y.Images, y.Status,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	if _, err := tx.Exec(ctx, `DELETE FROM yigim_items WHERE yigim_id=$1`, id); err != nil {
		return err
	}
	for _, it := range items {
		if _, err := tx.Exec(ctx, `
			INSERT INTO yigim_items (yigim_id, product_id, qty)
			VALUES ($1,$2,$3)`, id, it.ProductID, it.Qty); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) (*Yigim, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE yigims SET status=$2, updated_at=NOW() WHERE id=$1`, id, status)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, pgx.ErrNoRows
	}
	return r.Get(ctx, id)
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM yigims WHERE id=$1`, id)
	if err != nil {
		if dbx.IsFKViolation(err) {
			// Buyurtmalarda ishlatilgan — hard delete o‘rniga yopamiz
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
