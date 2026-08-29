package store

import (
	"context"
	"fmt"
	"strings"

	"jamaoxarid/backend/internal/models"
)

func (s *Store) Regions(ctx context.Context) ([]models.Region, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, name, COALESCE(code,'') FROM regions ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Region{}
	for rows.Next() {
		var r models.Region
		if err := rows.Scan(&r.ID, &r.Name, &r.Code); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) CreateRegion(ctx context.Context, name, code string) (*models.Region, error) {
	r := &models.Region{Name: strings.TrimSpace(name), Code: strings.TrimSpace(code)}
	err := s.Pool.QueryRow(ctx, `INSERT INTO regions (name, code) VALUES ($1,$2) RETURNING id`, r.Name, nullIfEmpty(r.Code)).Scan(&r.ID)
	return r, err
}

func (s *Store) UpdateRegion(ctx context.Context, id, name, code string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE regions SET name=$2, code=$3 WHERE id=$1`, id, strings.TrimSpace(name), nullIfEmpty(strings.TrimSpace(code)))
	return err
}

func (s *Store) DeleteRegion(ctx context.Context, id string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM regions WHERE id=$1`, id)
	return err
}

func (s *Store) Categories(ctx context.Context) ([]models.Category, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, name, created_at::text FROM categories ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Category{}
	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.ID, &c.Name, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) CreateCategory(ctx context.Context, name string) (*models.Category, error) {
	c := &models.Category{Name: strings.TrimSpace(name)}
	err := s.Pool.QueryRow(ctx, `INSERT INTO categories (name) VALUES ($1) RETURNING id`, c.Name).Scan(&c.ID)
	return c, err
}

func (s *Store) UpdateCategory(ctx context.Context, id, name string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE categories SET name=$2 WHERE id=$1`, id, strings.TrimSpace(name))
	return err
}

func (s *Store) DeleteCategory(ctx context.Context, id string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	productIDs, err := queryIDs(ctx, tx, `
		SELECT p.id FROM products p
		JOIN subcategories s ON s.id = p.subcategory_id
		WHERE s.category_id = $1`, id)
	if err != nil {
		return err
	}
	if err := purgeProductsTx(ctx, tx, productIDs); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM categories WHERE id=$1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) Subcategories(ctx context.Context, categoryID string) ([]models.Subcategory, error) {
	q := `SELECT id, category_id, name FROM subcategories`
	args := []any{}
	if categoryID != "" {
		q += ` WHERE category_id=$1`
		args = append(args, categoryID)
	}
	q += ` ORDER BY name`
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Subcategory{}
	for rows.Next() {
		var c models.Subcategory
		if err := rows.Scan(&c.ID, &c.CategoryID, &c.Name); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) CreateSubcategory(ctx context.Context, categoryID, name string) (*models.Subcategory, error) {
	c := &models.Subcategory{CategoryID: categoryID, Name: strings.TrimSpace(name)}
	err := s.Pool.QueryRow(ctx, `INSERT INTO subcategories (category_id, name) VALUES ($1,$2) RETURNING id`, categoryID, c.Name).Scan(&c.ID)
	return c, err
}

func (s *Store) UpdateSubcategory(ctx context.Context, id, name string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE subcategories SET name=$2 WHERE id=$1`, id, strings.TrimSpace(name))
	return err
}

func (s *Store) DeleteSubcategory(ctx context.Context, id string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	productIDs, err := queryIDs(ctx, tx, `SELECT id FROM products WHERE subcategory_id=$1`, id)
	if err != nil {
		return err
	}
	if err := purgeProductsTx(ctx, tx, productIDs); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM subcategories WHERE id=$1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) Products(ctx context.Context, subID string) ([]models.Product, error) {
	q := `
		SELECT p.id, p.subcategory_id, s.category_id, c.name, s.name, p.name, p.description,
		       p.unit_label, p.unit_price_uzs, p.photo_url, p.stock, p.active
		FROM products p
		JOIN subcategories s ON s.id=p.subcategory_id
		JOIN categories c ON c.id=s.category_id`
	args := []any{}
	if subID != "" {
		q += ` WHERE p.subcategory_id=$1`
		args = append(args, subID)
	}
	q += ` ORDER BY p.name`
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Product{}
	for rows.Next() {
		var p models.Product
		if err := rows.Scan(&p.ID, &p.SubcategoryID, &p.CategoryID, &p.CategoryName, &p.SubcategoryName,
			&p.Name, &p.Description, &p.UnitLabel, &p.UnitPriceUzs, &p.PhotoURL, &p.Stock, &p.Active); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) Product(ctx context.Context, id string) (*models.Product, error) {
	p := &models.Product{}
	err := s.Pool.QueryRow(ctx, `
		SELECT p.id, p.subcategory_id, s.category_id, c.name, s.name, p.name, p.description,
		       p.unit_label, p.unit_price_uzs, p.photo_url, p.stock, p.active
		FROM products p
		JOIN subcategories s ON s.id=p.subcategory_id
		JOIN categories c ON c.id=s.category_id
		WHERE p.id=$1`, id).Scan(&p.ID, &p.SubcategoryID, &p.CategoryID, &p.CategoryName, &p.SubcategoryName,
		&p.Name, &p.Description, &p.UnitLabel, &p.UnitPriceUzs, &p.PhotoURL, &p.Stock, &p.Active)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Store) CreateProduct(ctx context.Context, p models.Product) (*models.Product, error) {
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO products (subcategory_id, name, description, unit_label, unit_price_uzs, photo_url, stock, active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
		p.SubcategoryID, p.Name, p.Description, p.UnitLabel, p.UnitPriceUzs, p.PhotoURL, p.Stock, p.Active,
	).Scan(&p.ID)
	return &p, err
}

func (s *Store) UpdateProduct(ctx context.Context, p models.Product) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE products SET subcategory_id=$2, name=$3, description=$4, unit_label=$5, unit_price_uzs=$6,
			photo_url=$7, active=$8, stock=$9, updated_at=now()
		WHERE id=$1`,
		p.ID, p.SubcategoryID, p.Name, p.Description, p.UnitLabel, p.UnitPriceUzs, p.PhotoURL, p.Active, p.Stock)
	return err
}

func (s *Store) DeleteProduct(ctx context.Context, id string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := purgeProductsTx(ctx, tx, []string{id}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) MoveStock(ctx context.Context, productID, kind string, qty int, note, refType, refID, userID string) error {
	return s.moveStock(ctx, productID, kind, qty, note, refType, refID, userID, false)
}

func (s *Store) MoveStockForce(ctx context.Context, productID, kind string, qty int, note, refType, refID, userID string) error {
	return s.moveStock(ctx, productID, kind, qty, note, refType, refID, userID, true)
}

func (s *Store) moveStock(ctx context.Context, productID, kind string, qty int, note, refType, refID, userID string, allowNegative bool) error {
	if qty <= 0 {
		return fmt.Errorf("miqdor 0 dan katta bo‘lsin")
	}
	delta := qty
	if kind == "out" {
		delta = -qty
	} else if kind != "in" {
		return fmt.Errorf("kind in yoki out bo‘lsin")
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	q := `UPDATE products SET stock = stock + $2, updated_at=now() WHERE id=$1`
	if !allowNegative {
		q += ` AND stock + $2 >= 0`
	}
	tag, err := tx.Exec(ctx, q, productID, delta)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("omborda yetarli mahsulot yo‘q")
	}
	var ref any
	if refID != "" {
		ref = refID
	}
	var uid any
	if userID != "" {
		uid = userID
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO stock_moves (product_id, kind, quantity, note, ref_type, ref_id, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`, productID, kind, qty, note, nullIfEmpty(refType), ref, uid); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func (s *Store) StockMoves(ctx context.Context, productID string) ([]models.StockMove, error) {
	q := `
		SELECT m.id, m.product_id, p.name, m.kind, m.quantity, m.note, m.created_at::text
		FROM stock_moves m JOIN products p ON p.id=m.product_id`
	args := []any{}
	if productID != "" {
		q += ` WHERE m.product_id=$1`
		args = append(args, productID)
	}
	q += ` ORDER BY m.created_at DESC LIMIT 200`
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.StockMove{}
	for rows.Next() {
		var m models.StockMove
		if err := rows.Scan(&m.ID, &m.ProductID, &m.ProductName, &m.Kind, &m.Quantity, &m.Note, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) ProductIDByGroupBuy(ctx context.Context, gbID string) (string, error) {
	var id *string
	err := s.Pool.QueryRow(ctx, `SELECT product_id FROM group_buys WHERE id=$1`, gbID).Scan(&id)
	if err != nil || id == nil {
		return "", err
	}
	return *id, nil
}
