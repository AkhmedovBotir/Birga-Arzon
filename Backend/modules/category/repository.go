package category

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

func (r *Repository) Stats(ctx context.Context) (Stats, error) {
	var s Stats
	err := r.db.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM categories),
			(SELECT COUNT(*) FROM subcategories)
	`).Scan(&s.Categories, &s.Subcategories)
	return s, err
}

func (r *Repository) Tree(ctx context.Context) ([]CategoryNode, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, icon, COALESCE(image, ''), status,
			COALESCE((SELECT COUNT(*) FROM subcategories s WHERE s.category_id = c.id), 0)
		FROM categories c
		ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []CategoryNode
	var ids []uuid.UUID
	for rows.Next() {
		var n CategoryNode
		if err := rows.Scan(&n.ID, &n.Name, &n.Icon, &n.Image, &n.Status, &n.ChildrenCount); err != nil {
			return nil, err
		}
		n.Children = []SubcategoryNode{}
		list = append(list, n)
		ids = append(ids, n.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return list, nil
	}

	srows, err := r.db.Query(ctx, `
		SELECT id, category_id, name, status
		FROM subcategories
		WHERE category_id = ANY($1)
		ORDER BY name ASC`, ids)
	if err != nil {
		return nil, err
	}
	defer srows.Close()

	byParent := map[uuid.UUID][]SubcategoryNode{}
	for srows.Next() {
		var id, catID uuid.UUID
		var name, status string
		if err := srows.Scan(&id, &catID, &name, &status); err != nil {
			return nil, err
		}
		byParent[catID] = append(byParent[catID], SubcategoryNode{
			ID: id, Name: name, Status: status,
		})
	}
	if err := srows.Err(); err != nil {
		return nil, err
	}

	for i := range list {
		if kids, ok := byParent[list[i].ID]; ok {
			list[i].Children = kids
			list[i].ChildrenCount = len(kids)
		}
	}
	return list, nil
}

func (r *Repository) CreateCategory(ctx context.Context, c *Category) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO categories (name, icon, image, status)
		VALUES ($1,$2,$3,$4)
		RETURNING id, created_at, updated_at`,
		c.Name, c.Icon, c.Image, c.Status,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *Repository) UpdateCategory(ctx context.Context, id uuid.UUID, name, icon, image, status string) (*Category, error) {
	var c Category
	err := r.db.QueryRow(ctx, `
		UPDATE categories SET name=$2, icon=$3, image=$4, status=$5, updated_at=NOW()
		WHERE id=$1
		RETURNING id, name, icon, COALESCE(image, ''), status, created_at, updated_at`,
		id, name, icon, image, status,
	).Scan(&c.ID, &c.Name, &c.Icon, &c.Image, &c.Status, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) UpdateCategoryStatus(ctx context.Context, id uuid.UUID, status string) (*Category, error) {
	var c Category
	err := r.db.QueryRow(ctx, `
		UPDATE categories SET status=$2, updated_at=NOW()
		WHERE id=$1
		RETURNING id, name, icon, COALESCE(image, ''), status, created_at, updated_at`,
		id, status,
	).Scan(&c.ID, &c.Name, &c.Icon, &c.Image, &c.Status, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) DeleteCategory(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM categories WHERE id=$1`, id)
	if err != nil {
		if dbx.IsFKViolation(err) {
			_, err2 := r.UpdateCategoryStatus(ctx, id, "inactive")
			return err2
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("not found")
	}
	return nil
}

func (r *Repository) CreateSubcategory(ctx context.Context, s *Subcategory) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO subcategories (category_id, name, status)
		VALUES ($1,$2,$3)
		RETURNING id, created_at, updated_at`,
		s.CategoryID, s.Name, s.Status,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *Repository) UpdateSubcategory(ctx context.Context, id uuid.UUID, name, status string) (*Subcategory, error) {
	var s Subcategory
	err := r.db.QueryRow(ctx, `
		UPDATE subcategories SET name=$2, status=$3, updated_at=NOW()
		WHERE id=$1
		RETURNING id, category_id, name, status, created_at, updated_at`,
		id, name, status,
	).Scan(&s.ID, &s.CategoryID, &s.Name, &s.Status, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) UpdateSubcategoryStatus(ctx context.Context, id uuid.UUID, status string) (*Subcategory, error) {
	var s Subcategory
	err := r.db.QueryRow(ctx, `
		UPDATE subcategories SET status=$2, updated_at=NOW()
		WHERE id=$1
		RETURNING id, category_id, name, status, created_at, updated_at`,
		id, status,
	).Scan(&s.ID, &s.CategoryID, &s.Name, &s.Status, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) DeleteSubcategory(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM subcategories WHERE id=$1`, id)
	if err != nil {
		if dbx.IsFKViolation(err) {
			_, err2 := r.UpdateSubcategoryStatus(ctx, id, "inactive")
			return err2
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("not found")
	}
	return nil
}

func IsNoRows(err error) bool {
	return err == pgx.ErrNoRows
}
