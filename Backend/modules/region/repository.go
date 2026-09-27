package region

import (
	"context"
	"fmt"

	"birgaarzon/backend/internal/dbx"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Upsert(ctx context.Context, item *Region) error {
	const q = `
		INSERT INTO regions (legacy_id, name, code, type, parent_id, status)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (legacy_id) DO UPDATE SET
			name = EXCLUDED.name,
			code = EXCLUDED.code,
			type = EXCLUDED.type,
			parent_id = EXCLUDED.parent_id,
			status = EXCLUDED.status,
			updated_at = NOW()
		RETURNING id, created_at, updated_at`

	return r.db.QueryRow(ctx, q,
		item.LegacyID, item.Name, item.Code, item.Type, item.ParentID, item.Status,
	).Scan(&item.ID, &item.CreatedAt, &item.UpdatedAt)
}

func (r *Repository) FindIDByLegacy(ctx context.Context, legacyID string) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT id FROM regions WHERE legacy_id = $1`, legacyID).Scan(&id)
	return id, err
}

func (r *Repository) CountByType(ctx context.Context, typ string) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM regions WHERE type = $1`, typ).Scan(&n)
	return n, err
}

func (r *Repository) Stats(ctx context.Context) (Stats, error) {
	var s Stats
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE type = 'viloyat'),
			COUNT(*) FILTER (WHERE type = 'tuman'),
			COUNT(*) FILTER (WHERE type = 'mfy')
		FROM regions`).Scan(&s.Viloyat, &s.Tuman, &s.MFY)
	return s, err
}

func (r *Repository) TreeViloyatTuman(ctx context.Context) ([]RegionNode, error) {
	const q = `
		SELECT
			v.id, v.name, v.code, v.type, v.status,
			COALESCE((SELECT COUNT(*) FROM regions t WHERE t.parent_id = v.id AND t.type = 'tuman'), 0) AS children_count
		FROM regions v
		WHERE v.type = 'viloyat'
		ORDER BY v.name ASC`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var viloyats []RegionNode
	var ids []uuid.UUID
	for rows.Next() {
		var n RegionNode
		if err := rows.Scan(&n.ID, &n.Name, &n.Code, &n.Type, &n.Status, &n.ChildrenCount); err != nil {
			return nil, err
		}
		n.Children = []RegionNode{}
		viloyats = append(viloyats, n)
		ids = append(ids, n.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return viloyats, nil
	}

	const cq = `
		SELECT
			t.id, t.name, t.code, t.type, t.status, t.parent_id,
			COALESCE((SELECT COUNT(*) FROM regions m WHERE m.parent_id = t.id AND m.type = 'mfy'), 0) AS children_count
		FROM regions t
		WHERE t.type = 'tuman' AND t.parent_id = ANY($1)
		ORDER BY t.name ASC`

	crows, err := r.db.Query(ctx, cq, ids)
	if err != nil {
		return nil, err
	}
	defer crows.Close()

	byParent := map[uuid.UUID][]RegionNode{}
	for crows.Next() {
		var n RegionNode
		var parentID uuid.UUID
		if err := crows.Scan(&n.ID, &n.Name, &n.Code, &n.Type, &n.Status, &parentID, &n.ChildrenCount); err != nil {
			return nil, err
		}
		byParent[parentID] = append(byParent[parentID], n)
	}
	if err := crows.Err(); err != nil {
		return nil, err
	}

	for i := range viloyats {
		if kids, ok := byParent[viloyats[i].ID]; ok {
			viloyats[i].Children = kids
			viloyats[i].ChildrenCount = len(kids)
		}
	}
	return viloyats, nil
}

func (r *Repository) Children(ctx context.Context, parentID uuid.UUID, typ string) ([]Region, error) {
	q := `
		SELECT id, legacy_id, name, code, type, parent_id, status, created_at, updated_at
		FROM regions
		WHERE parent_id = $1`
	args := []any{parentID}
	if typ != "" {
		q += ` AND type = $2`
		args = append(args, typ)
	}
	q += ` ORDER BY name ASC`

	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Region
	for rows.Next() {
		var item Region
		if err := rows.Scan(
			&item.ID, &item.LegacyID, &item.Name, &item.Code, &item.Type,
			&item.ParentID, &item.Status, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*Region, error) {
	const q = `
		SELECT id, legacy_id, name, code, type, parent_id, status, created_at, updated_at
		FROM regions WHERE id = $1`
	var item Region
	err := r.db.QueryRow(ctx, q, id).Scan(
		&item.ID, &item.LegacyID, &item.Name, &item.Code, &item.Type,
		&item.ParentID, &item.Status, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *Repository) CreateManual(ctx context.Context, item *Region) error {
	if item.LegacyID == "" {
		item.LegacyID = "manual_" + uuid.NewString()
	}
	if item.Status == "" {
		item.Status = "active"
	}
	const q = `
		INSERT INTO regions (legacy_id, name, code, type, parent_id, status)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRow(ctx, q,
		item.LegacyID, item.Name, item.Code, item.Type, item.ParentID, item.Status,
	).Scan(&item.ID, &item.CreatedAt, &item.UpdatedAt)
}

func (r *Repository) Update(ctx context.Context, id uuid.UUID, name, code, status string) (*Region, error) {
	const q = `
		UPDATE regions SET name = $2, code = $3, status = $4, updated_at = NOW()
		WHERE id = $1
		RETURNING id, legacy_id, name, code, type, parent_id, status, created_at, updated_at`
	var item Region
	err := r.db.QueryRow(ctx, q, id, name, code, status).Scan(
		&item.ID, &item.LegacyID, &item.Name, &item.Code, &item.Type,
		&item.ParentID, &item.Status, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) (*Region, error) {
	const q = `
		UPDATE regions SET status = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING id, legacy_id, name, code, type, parent_id, status, created_at, updated_at`
	var item Region
	err := r.db.QueryRow(ctx, q, id, status).Scan(
		&item.ID, &item.LegacyID, &item.Name, &item.Code, &item.Type,
		&item.ParentID, &item.Status, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM regions WHERE id = $1`, id)
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

func (r *Repository) ListViloyats(ctx context.Context) ([]Region, error) {
	const q = `
		SELECT id, legacy_id, name, code, type, parent_id, status, created_at, updated_at
		FROM regions WHERE type = 'viloyat' ORDER BY name ASC`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Region
	for rows.Next() {
		var item Region
		if err := rows.Scan(
			&item.ID, &item.LegacyID, &item.Name, &item.Code, &item.Type,
			&item.ParentID, &item.Status, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func (r *Repository) Ping(ctx context.Context) error {
	return r.db.Ping(ctx)
}

func MapJSONType(t string) (string, error) {
	switch t {
	case "region":
		return TypeViloyat, nil
	case "district":
		return TypeTuman, nil
	case "mfy":
		return TypeMFY, nil
	default:
		return "", fmt.Errorf("unknown type: %s", t)
	}
}
