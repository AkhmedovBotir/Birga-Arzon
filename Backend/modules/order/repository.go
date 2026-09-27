package order

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

const orderSelect = `
		SELECT o.id, o.user_id, o.status, o.delivery_code, o.kuryer_id,
		       o.first_name, o.last_name, o.phone, o.viloyat_id, o.tuman_id,
		       o.viloyat_name, o.tuman_name, o.lat, o.lng, o.total_amount, o.note,
		       o.created_at, o.updated_at, o.assigned_at, o.delivered_at,
		       COALESCE(o.delivery_fee, 0), COALESCE(o.payment_status, 'unpaid'), COALESCE(o.payment_method, ''),
		       COALESCE(o.atmos_payment_id, ''), COALESCE(o.atmos_invoice, ''), o.paid_at,
		       COALESCE(TRIM(k.first_name || ' ' || k.last_name), ''), COALESCE(k.phone, ''),
		       COALESCE(TRIM(u.first_name || ' ' || u.last_name), u.phone, '')
		FROM orders o
		LEFT JOIN kuryers k ON k.id = o.kuryer_id
		LEFT JOIN user_profiles u ON u.id = o.user_id`

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

type yigimRow struct {
	ID         uuid.UUID
	Name       string
	ProductID  *uuid.UUID
	ProductName string
	Unit       string
	Price      float64
	Image      string
	Status     string
	TargetQty  int
	CurrentQty int
}

func (r *Repository) GetYigimForOrder(ctx context.Context, id uuid.UUID) (*yigimRow, error) {
	var y yigimRow
	var typ string
	err := r.db.QueryRow(ctx, `
		SELECT y.id, y.type,
		       COALESCE(NULLIF(y.name, ''), p.name, ''),
		       y.product_id,
		       COALESCE(p.name, ''),
		       COALESCE(p.unit, 'dona'),
		       COALESCE(p.price, 0),
		       COALESCE(
		         NULLIF(y.images[1], ''),
		         CASE WHEN p.images IS NOT NULL AND cardinality(p.images) >= 1 THEN p.images[1] ELSE '' END,
		         ''
		       ),
		       y.status, y.target_qty, y.current_qty
		FROM yigims y
		LEFT JOIN products p ON p.id = y.product_id
		WHERE y.id = $1`, id).Scan(
		&y.ID, &typ, &y.Name, &y.ProductID, &y.ProductName,
		&y.Unit, &y.Price, &y.Image, &y.Status, &y.TargetQty, &y.CurrentQty,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if typ == "combo" {
		var sum float64
		_ = r.db.QueryRow(ctx, `
			SELECT COALESCE(SUM(p.price * yi.qty), 0)
			FROM yigim_items yi
			JOIN products p ON p.id = yi.product_id
			WHERE yi.yigim_id = $1`, id).Scan(&sum)
		y.Price = sum
		y.Unit = "to‘plam"
		if y.Name == "" {
			y.Name = "Combo"
		}
	}
	return &y, nil
}

func (r *Repository) RegionName(ctx context.Context, id uuid.UUID) (string, error) {
	var name string
	err := r.db.QueryRow(ctx, `SELECT name FROM regions WHERE id=$1`, id).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return name, err
}

func (r *Repository) Create(ctx context.Context, o *Order, items []OrderItem, bump map[uuid.UUID]int) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `
		INSERT INTO orders (
			user_id, status, delivery_code, first_name, last_name, phone,
			viloyat_id, tuman_id, viloyat_name, tuman_name, lat, lng, total_amount, note,
			delivery_fee, payment_status
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		RETURNING id, created_at, updated_at`,
		o.UserID, o.Status, o.DeliveryCode, o.FirstName, o.LastName, o.Phone,
		o.ViloyatID, o.TumanID, o.ViloyatName, o.TumanName, o.Lat, o.Lng, o.TotalAmount, o.Note,
		o.DeliveryFee, PaymentUnpaid,
	).Scan(&o.ID, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return err
	}

	for i := range items {
		it := &items[i]
		it.OrderID = o.ID
		err = tx.QueryRow(ctx, `
			INSERT INTO order_items (order_id, yigim_id, product_id, product_name, unit, unit_price, qty, image)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			RETURNING id`,
			o.ID, it.YigimID, it.ProductID, it.ProductName, it.Unit, it.UnitPrice, it.Qty, it.Image,
		).Scan(&it.ID)
		if err != nil {
			return err
		}
	}
	o.Items = items

	for yigimID, qty := range bump {
		var target, current int
		var status string
		err = tx.QueryRow(ctx, `
			UPDATE yigims SET current_qty = current_qty + $2, updated_at = NOW()
			WHERE id = $1
			RETURNING target_qty, current_qty, status`,
			yigimID, qty,
		).Scan(&target, &current, &status)
		if err != nil {
			return err
		}
		if status == "active" && current >= target && target > 0 {
			_, err = tx.Exec(ctx, `
				UPDATE yigims SET status = 'inactive', updated_at = NOW() WHERE id = $1`, yigimID)
			if err != nil {
				return err
			}
		}
	}

	// If all related yigims are inactive, mark ready immediately
	var openCount int
	err = tx.QueryRow(ctx, `
		SELECT COUNT(*) FROM order_items oi
		JOIN yigims y ON y.id = oi.yigim_id
		WHERE oi.order_id = $1 AND y.status = 'active'`, o.ID).Scan(&openCount)
	if err != nil {
		return err
	}
	if openCount == 0 && o.Status == StatusWaiting {
		_, err = tx.Exec(ctx, `
			UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1`, o.ID, StatusReady)
		if err != nil {
			return err
		}
		o.Status = StatusReady
	}

	return tx.Commit(ctx)
}

func (r *Repository) Get(ctx context.Context, id uuid.UUID) (*Order, error) {
	o, err := r.scanOne(ctx, orderSelect+` WHERE o.id = $1`, id)
	if err != nil {
		return nil, err
	}
	items, err := r.listItems(ctx, id)
	if err != nil {
		return nil, err
	}
	o.Items = items
	return o.WithLabels(), nil
}

func (r *Repository) scanOne(ctx context.Context, q string, args ...any) (*Order, error) {
	var o Order
	err := r.db.QueryRow(ctx, q, args...).Scan(
		&o.ID, &o.UserID, &o.Status, &o.DeliveryCode, &o.KuryerID,
		&o.FirstName, &o.LastName, &o.Phone, &o.ViloyatID, &o.TumanID,
		&o.ViloyatName, &o.TumanName, &o.Lat, &o.Lng, &o.TotalAmount, &o.Note,
		&o.CreatedAt, &o.UpdatedAt, &o.AssignedAt, &o.DeliveredAt,
		&o.DeliveryFee, &o.PaymentStatus, &o.PaymentMethod,
		&o.AtmosPaymentID, &o.AtmosInvoice, &o.PaidAt,
		&o.KuryerName, &o.KuryerPhone, &o.UserFullName,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (r *Repository) listItems(ctx context.Context, orderID uuid.UUID) ([]OrderItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT oi.id, oi.order_id, oi.yigim_id, oi.product_id, oi.product_name, oi.unit,
		       oi.unit_price, oi.qty, oi.image, y.status, COALESCE(y.name, oi.product_name, '')
		FROM order_items oi
		JOIN yigims y ON y.id = oi.yigim_id
		WHERE oi.order_id = $1
		ORDER BY oi.created_at`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]OrderItem, 0)
	for rows.Next() {
		var it OrderItem
		if err := rows.Scan(
			&it.ID, &it.OrderID, &it.YigimID, &it.ProductID, &it.ProductName, &it.Unit,
			&it.UnitPrice, &it.Qty, &it.Image, &it.YigimStatus, &it.YigimName,
		); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID) ([]Order, error) {
	return r.list(ctx, orderSelect+`
		WHERE o.user_id = $1
		ORDER BY o.created_at DESC`, userID)
}

func (r *Repository) ListAdmin(ctx context.Context, status, q string) ([]Order, error) {
	args := []any{}
	where := []string{"1=1"}
	if status != "" {
		args = append(args, status)
		where = append(where, fmt.Sprintf("o.status = $%d", len(args)))
	}
	if strings.TrimSpace(q) != "" {
		args = append(args, "%"+strings.TrimSpace(q)+"%")
		n := len(args)
		where = append(where, fmt.Sprintf(
			`(o.phone ILIKE $%d OR o.first_name ILIKE $%d OR o.last_name ILIKE $%d
			  OR o.delivery_code ILIKE $%d OR CAST(o.id AS TEXT) ILIKE $%d)`,
			n, n, n, n, n,
		))
	}
	sql := orderSelect + fmt.Sprintf(`
		WHERE %s
		ORDER BY o.created_at DESC
		LIMIT 300`, strings.Join(where, " AND "))
	return r.list(ctx, sql, args...)
}

func (r *Repository) ListByKuryer(ctx context.Context, kuryerID uuid.UUID, history bool) ([]Order, error) {
	statusFilter := `o.status = 'assigned'`
	if history {
		statusFilter = `o.status = 'delivered'`
	}
	return r.list(ctx, orderSelect+fmt.Sprintf(`
		WHERE o.kuryer_id = $1 AND %s
		ORDER BY COALESCE(o.delivered_at, o.assigned_at, o.created_at) DESC
		LIMIT 200`, statusFilter), kuryerID)
}

func (r *Repository) list(ctx context.Context, q string, args ...any) ([]Order, error) {
	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Order, 0)
	ids := make([]uuid.UUID, 0)
	for rows.Next() {
		var o Order
		if err := rows.Scan(
			&o.ID, &o.UserID, &o.Status, &o.DeliveryCode, &o.KuryerID,
			&o.FirstName, &o.LastName, &o.Phone, &o.ViloyatID, &o.TumanID,
			&o.ViloyatName, &o.TumanName, &o.Lat, &o.Lng, &o.TotalAmount, &o.Note,
			&o.CreatedAt, &o.UpdatedAt, &o.AssignedAt, &o.DeliveredAt,
			&o.DeliveryFee, &o.PaymentStatus, &o.PaymentMethod,
			&o.AtmosPaymentID, &o.AtmosInvoice, &o.PaidAt,
			&o.KuryerName, &o.KuryerPhone, &o.UserFullName,
		); err != nil {
			return nil, err
		}
		o.WithLabels()
		out = append(out, o)
		ids = append(ids, o.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return out, nil
	}
	itemMap, err := r.listItemsForOrders(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range out {
		out[i].Items = itemMap[out[i].ID]
		if out[i].Items == nil {
			out[i].Items = []OrderItem{}
		}
	}
	return out, nil
}

func (r *Repository) listItemsForOrders(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID][]OrderItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT oi.id, oi.order_id, oi.yigim_id, oi.product_id, oi.product_name, oi.unit,
		       oi.unit_price, oi.qty, oi.image, y.status, COALESCE(y.name, oi.product_name, '')
		FROM order_items oi
		JOIN yigims y ON y.id = oi.yigim_id
		WHERE oi.order_id = ANY($1)
		ORDER BY oi.created_at`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	m := make(map[uuid.UUID][]OrderItem)
	for rows.Next() {
		var it OrderItem
		if err := rows.Scan(
			&it.ID, &it.OrderID, &it.YigimID, &it.ProductID, &it.ProductName, &it.Unit,
			&it.UnitPrice, &it.Qty, &it.Image, &it.YigimStatus, &it.YigimName,
		); err != nil {
			return nil, err
		}
		m[it.OrderID] = append(m[it.OrderID], it)
	}
	return m, rows.Err()
}

func (r *Repository) UpdatePaymentCard(ctx context.Context, orderID uuid.UUID, paymentID, invoice string, deliveryFee float64) error {
	_, err := r.db.Exec(ctx, `
		UPDATE orders SET
			payment_status = 'pending',
			payment_method = 'card',
			atmos_payment_id = $2,
			atmos_invoice = $3,
			delivery_fee = $4,
			updated_at = NOW()
		WHERE id = $1`, orderID, paymentID, invoice, deliveryFee)
	return err
}

func (r *Repository) MarkPaid(ctx context.Context, orderID uuid.UUID, paymentID, invoice string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE orders SET
			payment_status = 'paid',
			payment_method = 'card',
			atmos_payment_id = COALESCE(NULLIF($2, ''), atmos_payment_id),
			atmos_invoice = COALESCE(NULLIF($3, ''), atmos_invoice),
			paid_at = COALESCE(paid_at, NOW()),
			updated_at = NOW()
		WHERE id = $1`, orderID, paymentID, invoice)
	if err != nil {
		return err
	}
	_, _ = r.db.Exec(ctx, `
		UPDATE payments SET
			status = 'success',
			payment_id = CASE WHEN $2 <> '' THEN $2 ELSE payment_id END,
			updated_at = NOW()
		WHERE order_id = $1`, orderID, paymentID)
	return nil
}

func (r *Repository) MarkCOD(ctx context.Context, orderID uuid.UUID, deliveryFee float64) error {
	_, err := r.db.Exec(ctx, `
		UPDATE orders SET
			payment_status = 'cod',
			payment_method = 'cash',
			delivery_fee = $2,
			updated_at = NOW()
		WHERE id = $1 AND payment_status IN ('unpaid', 'pending')`, orderID, deliveryFee)
	return err
}

func (r *Repository) CreatePaymentRecord(ctx context.Context, orderID uuid.UUID, requestID, paymentID, token string, amount float64, amountTiyin int64, checkoutURL string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO payments (order_id, request_id, payment_id, token, amount, amount_tiyin, method, status, checkout_url)
		VALUES ($1,$2,$3,$4,$5,$6,'card','created',$7)
		ON CONFLICT (request_id) DO UPDATE SET
			payment_id = EXCLUDED.payment_id,
			token = EXCLUDED.token,
			checkout_url = EXCLUDED.checkout_url,
			updated_at = NOW()`,
		orderID, requestID, paymentID, token, amount, amountTiyin, checkoutURL)
	return err
}

type PaymentRecord struct {
	ID          uuid.UUID `json:"id"`
	OrderID     uuid.UUID `json:"order_id"`
	RequestID   string    `json:"request_id"`
	PaymentID   string    `json:"payment_id"`
	Token       string    `json:"token"`
	Amount      float64   `json:"amount"`
	AmountTiyin int64     `json:"amount_tiyin"`
	Method      string    `json:"method"`
	Status      string    `json:"status"`
	CheckoutURL string    `json:"checkout_url"`
}

func (r *Repository) GetLatestPaymentForOrder(ctx context.Context, orderID uuid.UUID) (*PaymentRecord, error) {
	var p PaymentRecord
	err := r.db.QueryRow(ctx, `
		SELECT id, order_id, request_id, payment_id, token, amount, amount_tiyin, method, status, checkout_url
		FROM payments
		WHERE order_id = $1
		ORDER BY created_at DESC
		LIMIT 1`, orderID).Scan(
		&p.ID, &p.OrderID, &p.RequestID, &p.PaymentID, &p.Token, &p.Amount, &p.AmountTiyin, &p.Method, &p.Status, &p.CheckoutURL,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &p, err
}

func (r *Repository) FindOrderByAny(ctx context.Context, identifiers ...string) (uuid.UUID, error) {
	for _, raw := range identifiers {
		val := strings.TrimSpace(raw)
		if val == "" || val == "0" || val == "<nil>" {
			continue
		}
		// 1. Direct UUID
		if uid, err := uuid.Parse(val); err == nil {
			var exists uuid.UUID
			if err := r.db.QueryRow(ctx, `SELECT id FROM orders WHERE id = $1`, uid).Scan(&exists); err == nil {
				return exists, nil
			}
		}

		// 2. Orders table atmos_invoice or atmos_payment_id
		var id uuid.UUID
		err := r.db.QueryRow(ctx, `
			SELECT id FROM orders
			WHERE atmos_invoice = $1 OR atmos_payment_id = $1
			ORDER BY created_at DESC
			LIMIT 1`, val).Scan(&id)
		if err == nil {
			return id, nil
		}

		// 3. Payments table payment_id, request_id, or token
		err = r.db.QueryRow(ctx, `
			SELECT order_id FROM payments
			WHERE payment_id = $1 OR request_id = $1 OR token = $1
			ORDER BY created_at DESC
			LIMIT 1`, val).Scan(&id)
		if err == nil {
			return id, nil
		}
	}
	return uuid.Nil, ErrNotFound
}

func (r *Repository) FindOrderIDByInvoice(ctx context.Context, invoice string) (uuid.UUID, error) {
	return r.FindOrderByAny(ctx, invoice)
}

func (r *Repository) FindOrderIDByAccount(ctx context.Context, account string) (uuid.UUID, error) {
	return r.FindOrderByAny(ctx, account)
}

func (r *Repository) SaveCallback(ctx context.Context, orderID uuid.UUID, paymentID string, payload []byte) error {
	_, err := r.db.Exec(ctx, `
		UPDATE payments SET
			status = 'success',
			payment_id = CASE WHEN $2 <> '' THEN $2 ELSE payment_id END,
			callback_payload = $3::jsonb,
			updated_at = NOW()
		WHERE order_id = $1 OR ($2 <> '' AND payment_id = $2)`, orderID, paymentID, string(payload))
	return err
}

type PaymentListItem struct {
	OrderID        uuid.UUID  `json:"order_id"`
	OrderStatus    string     `json:"order_status"`
	PaymentStatus  string     `json:"payment_status"`
	PaymentMethod  string     `json:"payment_method"`
	TotalAmount    float64    `json:"total_amount"`
	DeliveryFee    float64    `json:"delivery_fee"`
	PayableAmount  float64    `json:"payable_amount"`
	AtmosPaymentID string     `json:"atmos_payment_id"`
	AtmosInvoice   string     `json:"atmos_invoice"`
	RequestID      string     `json:"request_id,omitempty"`
	CheckoutURL    string     `json:"checkout_url,omitempty"`
	FirstName      string     `json:"first_name"`
	LastName       string     `json:"last_name"`
	Phone          string     `json:"phone"`
	UserFullName   string     `json:"user_full_name"`
	ViloyatName    string     `json:"viloyat_name"`
	TumanName      string     `json:"tuman_name"`
	CreatedAt      time.Time  `json:"created_at"`
	PaidAt         *time.Time `json:"paid_at,omitempty"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type PaymentStats struct {
	Total       int     `json:"total"`
	Unpaid      int     `json:"unpaid"`
	Pending     int     `json:"pending"`
	Paid        int     `json:"paid"`
	COD         int     `json:"cod"`
	PaidAmount  float64 `json:"paid_amount"`
	CODAmount   float64 `json:"cod_amount"`
	UnpaidAmount float64 `json:"unpaid_amount"`
	PendingAmount float64 `json:"pending_amount"`
}

func (r *Repository) PaymentStats(ctx context.Context) (PaymentStats, error) {
	var s PaymentStats
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE payment_status = 'unpaid'),
			COUNT(*) FILTER (WHERE payment_status = 'pending'),
			COUNT(*) FILTER (WHERE payment_status = 'paid'),
			COUNT(*) FILTER (WHERE payment_status = 'cod'),
			COALESCE(SUM(total_amount + delivery_fee) FILTER (WHERE payment_status = 'paid'), 0),
			COALESCE(SUM(total_amount + delivery_fee) FILTER (WHERE payment_status = 'cod'), 0),
			COALESCE(SUM(total_amount + delivery_fee) FILTER (WHERE payment_status = 'unpaid'), 0),
			COALESCE(SUM(total_amount + delivery_fee) FILTER (WHERE payment_status = 'pending'), 0)
		FROM orders
		WHERE status <> 'cancelled'`).Scan(
		&s.Total, &s.Unpaid, &s.Pending, &s.Paid, &s.COD,
		&s.PaidAmount, &s.CODAmount, &s.UnpaidAmount, &s.PendingAmount,
	)
	return s, err
}

func (r *Repository) ListPayments(ctx context.Context, paymentStatus, method, q string) ([]PaymentListItem, error) {
	args := []any{}
	where := []string{"o.status <> 'cancelled'"}
	if paymentStatus != "" {
		args = append(args, paymentStatus)
		where = append(where, fmt.Sprintf("o.payment_status = $%d", len(args)))
	}
	if method != "" {
		args = append(args, method)
		where = append(where, fmt.Sprintf("o.payment_method = $%d", len(args)))
	}
	if strings.TrimSpace(q) != "" {
		args = append(args, "%"+strings.TrimSpace(q)+"%")
		n := len(args)
		where = append(where, fmt.Sprintf(
			`(o.phone ILIKE $%d OR o.first_name ILIKE $%d OR o.last_name ILIKE $%d
			  OR o.atmos_payment_id ILIKE $%d OR o.atmos_invoice ILIKE $%d
			  OR CAST(o.id AS TEXT) ILIKE $%d)`,
			n, n, n, n, n, n,
		))
	}

	sql := fmt.Sprintf(`
		SELECT o.id, o.status, COALESCE(o.payment_status, 'unpaid'), COALESCE(o.payment_method, ''),
		       o.total_amount, COALESCE(o.delivery_fee, 0),
		       COALESCE(o.atmos_payment_id, ''), COALESCE(o.atmos_invoice, ''),
		       COALESCE(p.request_id, ''), COALESCE(p.checkout_url, ''),
		       o.first_name, o.last_name, o.phone,
		       COALESCE(TRIM(u.first_name || ' ' || u.last_name), u.phone, ''),
		       o.viloyat_name, o.tuman_name,
		       o.created_at, o.paid_at, o.updated_at
		FROM orders o
		LEFT JOIN user_profiles u ON u.id = o.user_id
		LEFT JOIN LATERAL (
			SELECT request_id, checkout_url
			FROM payments
			WHERE order_id = o.id
			ORDER BY created_at DESC
			LIMIT 1
		) p ON TRUE
		WHERE %s
		ORDER BY COALESCE(o.paid_at, o.updated_at, o.created_at) DESC
		LIMIT 400`, strings.Join(where, " AND "))

	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]PaymentListItem, 0)
	for rows.Next() {
		var it PaymentListItem
		if err := rows.Scan(
			&it.OrderID, &it.OrderStatus, &it.PaymentStatus, &it.PaymentMethod,
			&it.TotalAmount, &it.DeliveryFee,
			&it.AtmosPaymentID, &it.AtmosInvoice,
			&it.RequestID, &it.CheckoutURL,
			&it.FirstName, &it.LastName, &it.Phone, &it.UserFullName,
			&it.ViloyatName, &it.TumanName,
			&it.CreatedAt, &it.PaidAt, &it.UpdatedAt,
		); err != nil {
			return nil, err
		}
		it.PayableAmount = it.TotalAmount + it.DeliveryFee
		out = append(out, it)
	}
	return out, rows.Err()
}

func (r *Repository) Stats(ctx context.Context) (Stats, error) {
	var s Stats
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'waiting'),
			COUNT(*) FILTER (WHERE status = 'ready'),
			COUNT(*) FILTER (WHERE status = 'assigned'),
			COUNT(*) FILTER (WHERE status = 'delivered'),
			COUNT(*) FILTER (WHERE status = 'cancelled')
		FROM orders`).Scan(&s.Total, &s.Waiting, &s.Ready, &s.Assigned, &s.Delivered, &s.Cancelled)
	return s, err
}

func (r *Repository) KuryerStats(ctx context.Context, kuryerID uuid.UUID) (assigned, delivered int, err error) {
	err = r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status = 'assigned'),
			COUNT(*) FILTER (WHERE status = 'delivered')
		FROM orders WHERE kuryer_id = $1`, kuryerID).Scan(&assigned, &delivered)
	return
}

func (r *Repository) Assign(ctx context.Context, id, kuryerID uuid.UUID) (*Order, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE orders SET status = 'assigned', kuryer_id = $2, assigned_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND status IN ('ready', 'assigned')`, id, kuryerID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return r.Get(ctx, id)
}

func (r *Repository) Unassign(ctx context.Context, id uuid.UUID) (*Order, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE orders SET status = 'ready', kuryer_id = NULL, assigned_at = NULL, updated_at = NOW()
		WHERE id = $1 AND status = 'assigned'`, id)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return r.Get(ctx, id)
}

func (r *Repository) SetStatus(ctx context.Context, id uuid.UUID, status string) (*Order, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1`, id, status)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return r.Get(ctx, id)
}

func (r *Repository) Deliver(ctx context.Context, id, kuryerID uuid.UUID, code string) (*Order, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE orders SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND kuryer_id = $2 AND status = 'assigned' AND delivery_code = $3`,
		id, kuryerID, code)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, errors.New("kod noto‘g‘ri yoki buyurtma topilmadi")
	}
	return r.Get(ctx, id)
}

// MarkReadyForYigim moves waiting orders whose ALL yigims are inactive to ready.
func (r *Repository) MarkReadyForYigim(ctx context.Context, yigimID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE orders o SET status = 'ready', updated_at = NOW()
		WHERE o.status = 'waiting'
		  AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.yigim_id = $1)
		  AND NOT EXISTS (
		      SELECT 1 FROM order_items oi2
		      JOIN yigims y ON y.id = oi2.yigim_id
		      WHERE oi2.order_id = o.id AND y.status = 'active'
		  )`, yigimID)
	return err
}

func (r *Repository) KuryerExists(ctx context.Context, id uuid.UUID) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM kuryers WHERE id=$1 AND is_active=TRUE)`, id).Scan(&ok)
	return ok, err
}

// FindCourierForRegion prefers same tuman, then same viloyat; least busy active courier.
func (r *Repository) FindCourierForRegion(ctx context.Context, tumanID, viloyatID *uuid.UUID) (*uuid.UUID, error) {
	if tumanID != nil {
		var id uuid.UUID
		err := r.db.QueryRow(ctx, `
			SELECT k.id FROM kuryers k
			LEFT JOIN (
				SELECT kuryer_id, COUNT(*) AS cnt FROM orders
				WHERE status = 'assigned' AND kuryer_id IS NOT NULL
				GROUP BY kuryer_id
			) a ON a.kuryer_id = k.id
			WHERE k.is_active = TRUE AND k.tuman_id = $1
			ORDER BY COALESCE(a.cnt, 0) ASC, k.created_at ASC
			LIMIT 1`, *tumanID).Scan(&id)
		if err == nil {
			return &id, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}
	if viloyatID != nil {
		var id uuid.UUID
		err := r.db.QueryRow(ctx, `
			SELECT k.id FROM kuryers k
			LEFT JOIN (
				SELECT kuryer_id, COUNT(*) AS cnt FROM orders
				WHERE status = 'assigned' AND kuryer_id IS NOT NULL
				GROUP BY kuryer_id
			) a ON a.kuryer_id = k.id
			WHERE k.is_active = TRUE AND k.viloyat_id = $1
			ORDER BY COALESCE(a.cnt, 0) ASC, k.created_at ASC
			LIMIT 1`, *viloyatID).Scan(&id)
		if err == nil {
			return &id, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}
	return nil, ErrNotFound
}

func (r *Repository) ListReadyUnassignedIDs(ctx context.Context, yigimID *uuid.UUID) ([]uuid.UUID, error) {
	q := `
		SELECT o.id FROM orders o
		WHERE o.status = 'ready' AND o.kuryer_id IS NULL`
	args := []any{}
	if yigimID != nil {
		q += ` AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.yigim_id = $1)`
		args = append(args, *yigimID)
	}
	q += ` ORDER BY o.created_at ASC`
	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]uuid.UUID, 0)
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}
