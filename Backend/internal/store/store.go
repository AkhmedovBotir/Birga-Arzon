package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"jamaoxarid/backend/internal/authkit"
	"jamaoxarid/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	Pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store { return &Store{Pool: pool} }

// SeedAdmin creates an admin user only if none exists yet.
// Returns created=false when an admin is already present (password is not changed).
func (s *Store) SeedAdmin(ctx context.Context, username, password, phone string) (created bool, err error) {
	username = strings.TrimSpace(username)
	phone = strings.TrimSpace(phone)
	if username == "" {
		username = "admin"
	}
	if phone == "" {
		phone = "+998901111111"
	}
	if strings.TrimSpace(password) == "" {
		return false, fmt.Errorf("parol bo‘sh bo‘lmasin")
	}

	var existing string
	err = s.Pool.QueryRow(ctx, `
		SELECT COALESCE(NULLIF(username, ''), phone)
		FROM users WHERE role='admin'
		ORDER BY created_at
		LIMIT 1`).Scan(&existing)
	if err == nil {
		return false, nil
	}
	if err != pgx.ErrNoRows {
		return false, err
	}

	hash, err := authkit.HashPassword(password)
	if err != nil {
		return false, err
	}
	_, err = s.Pool.Exec(ctx, `
		INSERT INTO users (role, phone, username, password_hash, first_name, last_name, profile_completed)
		VALUES ('admin', $1, $2, $3, 'Admin', 'Jamoa', true)`,
		phone, username, hash)
	if err != nil {
		return false, err
	}
	return true, nil
}

func scanUser(row pgx.Row) (*models.User, error) {
	u := &models.User{}
	var regionName, cityName, mfyName *string
	err := row.Scan(
		&u.ID, &u.Role, &u.Phone, &u.FirstName, &u.LastName,
		&u.RegionID, &u.CityID, &u.MfyID, &u.DeliveryLat, &u.DeliveryLng, &u.DeliveryAddress,
		&u.TelegramID, &u.ProfileCompleted, &u.CreatedAt, &u.UpdatedAt, &regionName, &cityName, &mfyName,
	)
	if err != nil {
		return nil, err
	}
	u.PhoneMasked = authkit.MaskPhone(u.Phone)
	u.RegionName = regionName
	u.CityName = cityName
	u.MfyName = mfyName
	return u, nil
}

const userSelect = `
SELECT u.id, u.role, u.phone, u.first_name, u.last_name, u.region_id, u.city_id, u.mfy_id,
       u.delivery_lat, u.delivery_lng, u.delivery_address, u.telegram_id,
       u.profile_completed, u.created_at, u.updated_at, r.name, c.name, m.name
FROM users u
LEFT JOIN regions r ON r.id = u.region_id
LEFT JOIN cities c ON c.id = u.city_id
LEFT JOIN mfys m ON m.id = u.mfy_id`

func (s *Store) UserByID(ctx context.Context, id string) (*models.User, error) {
	u, err := scanUser(s.Pool.QueryRow(ctx, userSelect+` WHERE u.id=$1`, id))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return u, err
}

func (s *Store) UserByPhone(ctx context.Context, phone string) (*models.User, error) {
	u, err := scanUser(s.Pool.QueryRow(ctx, userSelect+` WHERE u.phone=$1`, phone))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return u, err
}

func (s *Store) UserByUsername(ctx context.Context, username string) (*models.User, error) {
	u, err := scanUser(s.Pool.QueryRow(ctx, userSelect+` WHERE lower(u.username)=lower($1)`, username))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return u, err
}

func (s *Store) PasswordHash(ctx context.Context, userID string) (string, error) {
	var h *string
	err := s.Pool.QueryRow(ctx, `SELECT password_hash FROM users WHERE id=$1`, userID).Scan(&h)
	if err != nil {
		return "", err
	}
	if h == nil {
		return "", nil
	}
	return *h, nil
}

func (s *Store) CreateCustomer(ctx context.Context, phone, first, last string, telegramID *int64) (*models.User, error) {
	var id string
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO users (role, phone, first_name, last_name, telegram_id, profile_completed)
		VALUES ('customer', $1, $2, $3, $4, false)
		RETURNING id`, phone, first, last, telegramID).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.UserByID(ctx, id)
}

func (s *Store) UpdateProfile(ctx context.Context, id string, first, last string, regionID, cityID, mfyID *string, lat, lng *float64, addr *string) (*models.User, error) {
	completed := cityID != nil && mfyID != nil && first != "" && last != ""
	_, err := s.Pool.Exec(ctx, `
		UPDATE users SET first_name=$2, last_name=$3, region_id=$4, city_id=$5, mfy_id=$6,
			delivery_lat=$7, delivery_lng=$8, delivery_address=$9,
			profile_completed=$10, updated_at=now()
		WHERE id=$1`, id, first, last, regionID, cityID, mfyID, lat, lng, addr, completed)
	if err != nil {
		return nil, err
	}
	return s.UserByID(ctx, id)
}

func (s *Store) LinkTelegram(ctx context.Context, userID string, tgID int64) error {
	_, err := s.Pool.Exec(ctx, `UPDATE users SET telegram_id=$2, updated_at=now() WHERE id=$1`, userID, tgID)
	return err
}

func (s *Store) ListUsers(ctx context.Context, cityID, mfyID, q string) ([]models.User, error) {
	sql := userSelect + ` WHERE u.role='customer'`
	args := []any{}
	i := 1
	if cityID != "" {
		sql += fmt.Sprintf(` AND u.city_id=$%d`, i)
		args = append(args, cityID)
		i++
	}
	if mfyID != "" {
		sql += fmt.Sprintf(` AND u.mfy_id=$%d`, i)
		args = append(args, mfyID)
		i++
	}
	if q != "" {
		sql += fmt.Sprintf(` AND (u.first_name ILIKE $%d OR u.last_name ILIKE $%d OR u.phone ILIKE $%d)`, i, i, i)
		args = append(args, "%"+q+"%")
	}
	sql += ` ORDER BY u.created_at DESC`
	rows, err := s.Pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		u.Phone = u.PhoneMasked
		out = append(out, *u)
	}
	if out == nil {
		out = []models.User{}
	}
	return out, rows.Err()
}

func (s *Store) ListByRole(ctx context.Context, role string) ([]models.User, error) {
	rows, err := s.Pool.Query(ctx, userSelect+` WHERE u.role=$1 ORDER BY u.created_at DESC`, role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *u)
	}
	if out == nil {
		out = []models.User{}
	}
	return out, rows.Err()
}

func (s *Store) CreateStaff(ctx context.Context, role, phone, first, last, passwordHash string, regionID, cityID, mfyID *string) (*models.User, error) {
	var id string
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO users (role, phone, password_hash, first_name, last_name, region_id, city_id, mfy_id, profile_completed)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
		RETURNING id`, role, phone, passwordHash, first, last, regionID, cityID, mfyID).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.UserByID(ctx, id)
}

func (s *Store) UpdateStaff(ctx context.Context, id, first, last, phone string, regionID, cityID, mfyID, passwordHash *string) error {
	if passwordHash != nil && *passwordHash != "" {
		_, err := s.Pool.Exec(ctx, `
			UPDATE users SET first_name=$2, last_name=$3, phone=$4, region_id=$5, city_id=$6, mfy_id=$7, password_hash=$8, updated_at=now()
			WHERE id=$1 AND role='courier'`, id, first, last, phone, regionID, cityID, mfyID, *passwordHash)
		return err
	}
	_, err := s.Pool.Exec(ctx, `
		UPDATE users SET first_name=$2, last_name=$3, phone=$4, region_id=$5, city_id=$6, mfy_id=$7, updated_at=now()
		WHERE id=$1 AND role='courier'`, id, first, last, phone, regionID, cityID, mfyID)
	return err
}

func (s *Store) DeleteCourier(ctx context.Context, id string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM users WHERE id=$1 AND role='courier'`, id)
	return err
}

func (s *Store) SaveOTP(ctx context.Context, phone, hash string, exp time.Time) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1,$2,$3)`, phone, hash, exp)
	return err
}

func (s *Store) ConsumeOTP(ctx context.Context, phone, hash string) (bool, error) {
	tag, err := s.Pool.Exec(ctx, `
		UPDATE otp_codes SET used_at=now()
		WHERE id=(
			SELECT id FROM otp_codes
			WHERE phone=$1 AND code_hash=$2 AND used_at IS NULL AND expires_at > now()
			ORDER BY created_at DESC LIMIT 1
		)`, phone, hash)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func (s *Store) LastOTPCreated(ctx context.Context, phone string) (time.Time, error) {
	var t time.Time
	err := s.Pool.QueryRow(ctx, `SELECT created_at FROM otp_codes WHERE phone=$1 ORDER BY created_at DESC LIMIT 1`, phone).Scan(&t)
	if err == pgx.ErrNoRows {
		return time.Time{}, nil
	}
	return t, err
}

func (s *Store) Cities(ctx context.Context, regionID string) ([]models.City, error) {
	q := `SELECT id, name, region_id FROM cities`
	args := []any{}
	if regionID != "" {
		q += ` WHERE region_id=$1`
		args = append(args, regionID)
	}
	q += ` ORDER BY name`
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.City
	for rows.Next() {
		var c models.City
		if err := rows.Scan(&c.ID, &c.Name, &c.RegionID); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if out == nil {
		out = []models.City{}
	}
	return out, rows.Err()
}

func (s *Store) MfysByCity(ctx context.Context, cityID string) ([]models.Mfy, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, city_id, name, pickup_address, lat, lng FROM mfys WHERE city_id=$1 ORDER BY name`, cityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Mfy
	for rows.Next() {
		var m models.Mfy
		if err := rows.Scan(&m.ID, &m.CityID, &m.Name, &m.PickupAddress, &m.Lat, &m.Lng); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	if out == nil {
		out = []models.Mfy{}
	}
	return out, rows.Err()
}

func (s *Store) CreateCity(ctx context.Context, name string, regionID *string) (*models.City, error) {
	c := &models.City{Name: strings.TrimSpace(name), RegionID: regionID}
	err := s.Pool.QueryRow(ctx, `INSERT INTO cities (name, region_id) VALUES ($1,$2) RETURNING id`, c.Name, regionID).Scan(&c.ID)
	return c, err
}

func (s *Store) CreateMfy(ctx context.Context, cityID, name, addr string, lat, lng *float64) (*models.Mfy, error) {
	m := &models.Mfy{CityID: cityID, Name: strings.TrimSpace(name)}
	if addr != "" {
		m.PickupAddress = &addr
	}
	m.Lat, m.Lng = lat, lng
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO mfys (city_id, name, pickup_address, lat, lng) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		cityID, m.Name, m.PickupAddress, lat, lng).Scan(&m.ID)
	return m, err
}

func (s *Store) UpdateCity(ctx context.Context, id, name string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE cities SET name=$2 WHERE id=$1`, id, strings.TrimSpace(name))
	return err
}

func (s *Store) UpdateMfy(ctx context.Context, id, name, addr string) error {
	var pickup any
	if strings.TrimSpace(addr) != "" {
		pickup = strings.TrimSpace(addr)
	}
	_, err := s.Pool.Exec(ctx, `UPDATE mfys SET name=$2, pickup_address=$3 WHERE id=$1`, id, strings.TrimSpace(name), pickup)
	return err
}

func (s *Store) DeleteCity(ctx context.Context, id string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM cities WHERE id=$1`, id)
	return err
}

func (s *Store) DeleteMfy(ctx context.Context, id string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM mfys WHERE id=$1`, id)
	return err
}

func scanGB(row pgx.Row) (*models.GroupBuy, error) {
	g := &models.GroupBuy{}
	err := row.Scan(&g.ID, &g.Title, &g.Description, &g.PhotoURL, &g.PhotoURLs, &g.ProductID, &g.UnitLabel, &g.UnitPriceUzs,
		&g.MinVolume, &g.CurrentVolume, &g.Status, &g.CashOnDeliveryAllowed, &g.CreatedAt)
	if err != nil {
		return nil, err
	}
	if g.PhotoURLs == nil {
		g.PhotoURLs = []string{}
	}
	return g, nil
}

func (s *Store) GroupBuy(ctx context.Context, id string) (*models.GroupBuy, error) {
	g, err := scanGB(s.Pool.QueryRow(ctx, `
		SELECT id, title, description, photo_url, COALESCE(photo_urls, '{}'), product_id, unit_label, unit_price_uzs, min_volume, current_volume, status, cash_on_delivery_allowed, created_at
		FROM group_buys WHERE id=$1`, id))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return g, err
}

func (s *Store) ListGroupBuys(ctx context.Context, status string) ([]models.GroupBuy, error) {
	q := `SELECT id, title, description, photo_url, COALESCE(photo_urls, '{}'), product_id, unit_label, unit_price_uzs, min_volume, current_volume, status, cash_on_delivery_allowed, created_at FROM group_buys`
	args := []any{}
	if status != "" {
		q += ` WHERE status=$1`
		args = append(args, status)
	}
	q += ` ORDER BY created_at DESC`
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.GroupBuy
	for rows.Next() {
		g, err := scanGB(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *g)
	}
	if out == nil {
		out = []models.GroupBuy{}
	}
	return out, rows.Err()
}

func (s *Store) CreateGroupBuy(ctx context.Context, g models.GroupBuy, createdBy string) (*models.GroupBuy, error) {
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO group_buys (title, description, photo_url, photo_urls, product_id, unit_label, unit_price_uzs, min_volume, status, cash_on_delivery_allowed, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open',$9,$10)
		RETURNING id, created_at`,
		g.Title, g.Description, g.PhotoURL, g.PhotoURLs, g.ProductID, g.UnitLabel, g.UnitPriceUzs, g.MinVolume, g.CashOnDeliveryAllowed, createdBy,
	).Scan(&g.ID, &g.CreatedAt)
	g.Status = "open"
	g.CurrentVolume = 0
	return &g, err
}

func (s *Store) UpdateGroupBuy(ctx context.Context, g models.GroupBuy) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE group_buys
		SET title=$2, description=$3, photo_url=$4, photo_urls=$5, product_id=$6,
		    unit_label=$7, unit_price_uzs=$8, min_volume=$9, updated_at=now()
		WHERE id=$1 AND status='open'`,
		g.ID, g.Title, g.Description, g.PhotoURL, g.PhotoURLs, g.ProductID, g.UnitLabel, g.UnitPriceUzs, g.MinVolume)
	return err
}

func (s *Store) GroupBuyHasOrders(ctx context.Context, id string) (bool, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM order_items WHERE group_buy_id=$1`, id).Scan(&n)
	return n > 0, err
}

func (s *Store) DeleteGroupBuy(ctx context.Context, id string) error {
	if _, err := s.Pool.Exec(ctx, `DELETE FROM cart_items WHERE group_buy_id=$1`, id); err != nil {
		return err
	}
	_, err := s.Pool.Exec(ctx, `DELETE FROM group_buys WHERE id=$1`, id)
	return err
}

func (s *Store) SetGroupBuyStatus(ctx context.Context, id, status string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE group_buys SET status=$2, updated_at=now() WHERE id=$1`, id, status)
	return err
}

func (s *Store) RecalcVolume(ctx context.Context, id string) (int, error) {
	var vol int
	err := s.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(oi.quantity), 0)
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE oi.group_buy_id=$1 AND o.status NOT IN ('cancelled')`, id).Scan(&vol)
	if err != nil {
		return 0, err
	}
	_, err = s.Pool.Exec(ctx, `UPDATE group_buys SET current_volume=$2, updated_at=now() WHERE id=$1`, id, vol)
	return vol, err
}

func (s *Store) Cart(ctx context.Context, userID string) ([]models.CartItem, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT c.group_buy_id, g.title, g.unit_label, g.unit_price_uzs, c.quantity, g.photo_url, g.min_volume, g.current_volume, g.status
		FROM cart_items c JOIN group_buys g ON g.id=c.group_buy_id
		WHERE c.user_id=$1 ORDER BY c.updated_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.CartItem
	for rows.Next() {
		var it models.CartItem
		if err := rows.Scan(&it.GroupBuyID, &it.Title, &it.UnitLabel, &it.UnitPriceUzs, &it.Quantity, &it.PhotoURL, &it.MinVolume, &it.CurrentVolume, &it.Status); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	if out == nil {
		out = []models.CartItem{}
	}
	return out, rows.Err()
}

func (s *Store) UpsertCart(ctx context.Context, userID, gbID string, qty int) error {
	if qty <= 0 {
		_, err := s.Pool.Exec(ctx, `DELETE FROM cart_items WHERE user_id=$1 AND group_buy_id=$2`, userID, gbID)
		return err
	}
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO cart_items (user_id, group_buy_id, quantity) VALUES ($1,$2,$3)
		ON CONFLICT (user_id, group_buy_id) DO UPDATE SET quantity=$3, updated_at=now()`, userID, gbID, qty)
	return err
}

func (s *Store) ClearCart(ctx context.Context, tx pgx.Tx, userID string) error {
	_, err := tx.Exec(ctx, `DELETE FROM cart_items WHERE user_id=$1`, userID)
	return err
}

func (s *Store) Notify(ctx context.Context, userID, title, body string) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO notifications (user_id, title, body) VALUES ($1,$2,$3)`, userID, title, body)
	return err
}

func (s *Store) Notifications(ctx context.Context, userID string) ([]map[string]any, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, title, body, read, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		var id, title, body string
		var read bool
		var at time.Time
		if err := rows.Scan(&id, &title, &body, &read, &at); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "title": title, "body": body, "read": read, "createdAt": at})
	}
	if out == nil {
		out = []map[string]any{}
	}
	return out, rows.Err()
}

func (s *Store) NewID() string { return uuid.NewString() }
