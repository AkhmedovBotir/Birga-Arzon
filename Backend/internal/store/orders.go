package store

import (
	"context"
	"time"

	"jamaoxarid/backend/internal/authkit"
	"jamaoxarid/backend/internal/models"

	"github.com/jackc/pgx/v5"
)

func (s *Store) CreateOrderTx(ctx context.Context, tx pgx.Tx, o *models.Order) error {
	return tx.QueryRow(ctx, `
		INSERT INTO orders (user_id, delivery_method, delivery_fee_uzs, status, city_id, mfy_id, delivery_lat, delivery_lng, delivery_address)
		VALUES ($1,$2,$3,'collecting',$4,$5,$6,$7,$8)
		RETURNING id, created_at`,
		o.UserID, o.DeliveryMethod, o.DeliveryFeeUzs, o.CityID, o.MfyID, o.DeliveryLat, o.DeliveryLng, o.DeliveryAddress,
	).Scan(&o.ID, &o.CreatedAt)
}

func (s *Store) InsertItemTx(ctx context.Context, tx pgx.Tx, orderID string, it models.OrderItem) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO order_items (order_id, group_buy_id, product_id, title, quantity, unit_price_uzs, unit_label)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`, orderID, it.GroupBuyID, it.ProductID, it.Title, it.Quantity, it.UnitPriceUzs, it.UnitLabel)
	return err
}

func (s *Store) LockGroupBuy(ctx context.Context, tx pgx.Tx, id string) (*models.GroupBuy, error) {
	g := &models.GroupBuy{}
	err := tx.QueryRow(ctx, `
		SELECT g.id, COALESCE(g.kind,'product'), g.title, g.description, g.photo_url, g.product_id, g.unit_label, g.unit_price_uzs,
		       g.min_volume, g.current_volume, COALESCE(p.stock, 0), g.status, g.cash_on_delivery_allowed, g.created_at
		FROM group_buys g
		LEFT JOIN products p ON p.id = g.product_id
		WHERE g.id=$1 FOR UPDATE OF g`, id).Scan(
		&g.ID, &g.Kind, &g.Title, &g.Description, &g.PhotoURL, &g.ProductID, &g.UnitLabel, &g.UnitPriceUzs,
		&g.MinVolume, &g.CurrentVolume, &g.Stock, &g.Status, &g.CashOnDeliveryAllowed, &g.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `
		SELECT gi.product_id, gi.quantity, p.name, p.unit_label, p.unit_price_uzs, p.stock
		FROM group_buy_items gi
		JOIN products p ON p.id = gi.product_id
		WHERE gi.group_buy_id=$1`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		it := models.GroupBuyItem{}
		if err := rows.Scan(&it.ProductID, &it.Quantity, &it.Name, &it.UnitLabel, &it.UnitPriceUzs, &it.Stock); err != nil {
			return nil, err
		}
		g.Items = append(g.Items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	g.ApplySellStock()
	return g, nil
}

func (s *Store) RecalcVolumeTx(ctx context.Context, tx pgx.Tx, id string) (int, string, int, error) {
	var vol, min int
	var status string
	err := tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(oi.quantity), 0)
		FROM order_items oi JOIN orders o ON o.id=oi.order_id
		WHERE oi.group_buy_id=$1 AND o.status <> 'cancelled'`, id).Scan(&vol)
	if err != nil {
		return 0, "", 0, err
	}
	err = tx.QueryRow(ctx, `SELECT min_volume, status FROM group_buys WHERE id=$1`, id).Scan(&min, &status)
	if err != nil {
		return 0, "", 0, err
	}
	_, err = tx.Exec(ctx, `UPDATE group_buys SET current_volume=$2, updated_at=now() WHERE id=$1`, id, vol)
	return vol, status, min, err
}

func (s *Store) Order(ctx context.Context, id string) (*models.Order, error) {
	return s.scanOrder(ctx, s.Pool, `WHERE o.id=$1`, id)
}

func (s *Store) scanOrder(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, where string, args ...any) (*models.Order, error) {
	o := &models.Order{}
	var code *string
	var fn, ln, phone string
	err := q.QueryRow(ctx, `
		SELECT o.id, o.user_id, o.delivery_method, o.delivery_fee_uzs, o.payment_provider, o.status,
		       o.pickup_code, o.payment_deadline_at, o.city_id, ct.region_id, o.mfy_id, o.delivery_lat, o.delivery_lng,
		       o.delivery_address, o.created_at, u.first_name, u.last_name, u.phone
		FROM orders o
		JOIN users u ON u.id=o.user_id
		LEFT JOIN cities ct ON ct.id = o.city_id `+where, args...).Scan(
		&o.ID, &o.UserID, &o.DeliveryMethod, &o.DeliveryFeeUzs, &o.PaymentProvider, &o.Status,
		&code, &o.PaymentDeadlineAt, &o.CityID, &o.RegionID, &o.MfyID, &o.DeliveryLat, &o.DeliveryLng,
		&o.DeliveryAddress, &o.CreatedAt, &fn, &ln, &phone,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	o.CustomerName = fn + " " + ln
	o.CustomerPhone = authkit.MaskPhone(phone)
	if code != nil && *code != "" {
		o.PickupCode = *code
		o.HasPickupCode = true
	}
	items, err := s.orderItems(ctx, q, o.ID)
	if err != nil {
		return nil, err
	}
	o.Items = items
	for _, it := range items {
		o.SubtotalUzs += it.UnitPriceUzs * int64(it.Quantity)
	}
	o.TotalUzs = o.SubtotalUzs + o.DeliveryFeeUzs
	return o, nil
}

func (s *Store) orderItems(ctx context.Context, q interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, orderID string) ([]models.OrderItem, error) {
	rows, err := q.Query(ctx, `
		SELECT id, group_buy_id, product_id, title, quantity, unit_price_uzs, unit_label
		FROM order_items WHERE order_id=$1`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.OrderItem
	for rows.Next() {
		var it models.OrderItem
		if err := rows.Scan(&it.ID, &it.GroupBuyID, &it.ProductID, &it.Title, &it.Quantity, &it.UnitPriceUzs, &it.UnitLabel); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	if out == nil {
		out = []models.OrderItem{}
	}
	return out, rows.Err()
}

func (s *Store) ListOrdersByUser(ctx context.Context, userID string) ([]models.Order, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id FROM orders WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	out := []models.Order{}
	for _, id := range ids {
		o, err := s.Order(ctx, id)
		if err != nil {
			return nil, err
		}
		if o != nil {
			out = append(out, *o)
		}
	}
	return out, nil
}

func (s *Store) ListOrders(ctx context.Context, status string) ([]models.Order, error) {
	q := `SELECT id FROM orders`
	args := []any{}
	if status != "" {
		q += ` WHERE status=$1`
		args = append(args, status)
	}
	q += ` ORDER BY created_at DESC LIMIT 200`
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	out := []models.Order{}
	for _, id := range ids {
		o, err := s.Order(ctx, id)
		if err != nil {
			return nil, err
		}
		if o != nil {
			out = append(out, *o)
		}
	}
	return out, nil
}

func (s *Store) ListOrdersByCity(ctx context.Context, status, cityID string) ([]models.Order, error) {
	if cityID == "" {
		return s.ListOrders(ctx, status)
	}
	q := `SELECT id FROM orders WHERE city_id=$1`
	args := []any{cityID}
	if status != "" {
		q += ` AND status=$2`
		args = append(args, status)
	}
	q += ` ORDER BY created_at DESC LIMIT 200`
	return s.listOrdersQuery(ctx, q, args...)
}

func (s *Store) ListOrdersByRegion(ctx context.Context, status, regionID string) ([]models.Order, error) {
	if regionID == "" {
		return s.ListOrders(ctx, status)
	}
	q := `SELECT o.id FROM orders o JOIN cities c ON c.id=o.city_id WHERE c.region_id=$1`
	args := []any{regionID}
	if status != "" {
		q += ` AND o.status=$2`
		args = append(args, status)
	}
	q += ` ORDER BY o.created_at DESC LIMIT 200`
	return s.listOrdersQuery(ctx, q, args...)
}

func (s *Store) listOrdersQuery(ctx context.Context, q string, args ...any) ([]models.Order, error) {
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	out := []models.Order{}
	for _, id := range ids {
		o, err := s.Order(ctx, id)
		if err != nil {
			return nil, err
		}
		if o != nil {
			out = append(out, *o)
		}
	}
	return out, nil
}

func (s *Store) SetOrderStatus(ctx context.Context, id, status string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE orders SET status=$2, updated_at=now() WHERE id=$1`, id, status)
	return err
}

func (s *Store) SetOrderStatusTx(ctx context.Context, tx pgx.Tx, id, status string) error {
	_, err := tx.Exec(ctx, `UPDATE orders SET status=$2, updated_at=now() WHERE id=$1`, id, status)
	return err
}

func (s *Store) SetPaymentDeadline(ctx context.Context, id string, at time.Time) error {
	_, err := s.Pool.Exec(ctx, `UPDATE orders SET status='awaiting_payment', payment_deadline_at=$2, updated_at=now() WHERE id=$1 AND status='collecting'`, id, at)
	return err
}

func (s *Store) OrdersForGroupBuy(ctx context.Context, gbID string) ([]models.Order, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT DISTINCT o.id FROM orders o
		JOIN order_items oi ON oi.order_id=o.id
		WHERE oi.group_buy_id=$1 AND o.status <> 'cancelled'
		ORDER BY o.id`, gbID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	out := []models.Order{}
	for _, id := range ids {
		o, err := s.Order(ctx, id)
		if err != nil {
			return nil, err
		}
		if o != nil {
			out = append(out, *o)
		}
	}
	return out, nil
}

func (s *Store) CollectingOrdersForGroupBuy(ctx context.Context, gbID string) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT DISTINCT o.id FROM orders o
		JOIN order_items oi ON oi.order_id=o.id
		WHERE oi.group_buy_id=$1 AND o.status='collecting'`, gbID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (s *Store) OrderGroupBuyStatuses(ctx context.Context, orderID string) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT g.status FROM order_items oi JOIN group_buys g ON g.id=oi.group_buy_id WHERE oi.order_id=$1`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var st []string
	for rows.Next() {
		var s0 string
		if err := rows.Scan(&s0); err != nil {
			return nil, err
		}
		st = append(st, s0)
	}
	return st, rows.Err()
}

func (s *Store) OrderGroupBuyIDs(ctx context.Context, orderID string) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `SELECT DISTINCT group_buy_id FROM order_items WHERE order_id=$1`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (s *Store) MixedOrderIDs(ctx context.Context) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT order_id FROM order_items
		GROUP BY order_id
		HAVING COUNT(DISTINCT group_buy_id) > 1`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (s *Store) CloneOrderLiteTx(ctx context.Context, tx pgx.Tx, srcID string, fee int64) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `
		INSERT INTO orders (user_id, delivery_method, delivery_fee_uzs, status, city_id, mfy_id,
			delivery_lat, delivery_lng, delivery_address, payment_provider, payment_deadline_at)
		SELECT user_id, delivery_method, $2, status, city_id, mfy_id,
			delivery_lat, delivery_lng, delivery_address, payment_provider, payment_deadline_at
		FROM orders WHERE id=$1
		RETURNING id`, srcID, fee).Scan(&id)
	return id, err
}

func (s *Store) MoveOrderItemTx(ctx context.Context, tx pgx.Tx, itemID, newOrderID string) error {
	_, err := tx.Exec(ctx, `UPDATE order_items SET order_id=$2 WHERE id=$1`, itemID, newOrderID)
	return err
}

func (s *Store) CopyPickupCodeTx(ctx context.Context, tx pgx.Tx, srcID, dstID string) error {
	_, err := tx.Exec(ctx, `
		UPDATE orders SET pickup_code = src.pickup_code, updated_at=now()
		FROM orders src
		WHERE orders.id=$2 AND src.id=$1 AND src.pickup_code IS NOT NULL AND src.pickup_code <> ''`, srcID, dstID)
	return err
}

func (s *Store) PickupCode(ctx context.Context, orderID string) (string, error) {
	var c *string
	err := s.Pool.QueryRow(ctx, `SELECT pickup_code FROM orders WHERE id=$1`, orderID).Scan(&c)
	if err != nil || c == nil {
		return "", err
	}
	return *c, nil
}

func (s *Store) SetPickupCode(ctx context.Context, orderID, code string) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE orders SET pickup_code=$2, updated_at=now()
		WHERE id=$1 AND (pickup_code IS NULL OR pickup_code='')`, orderID, code)
	return err
}

func (s *Store) SetPickupAndPaid(ctx context.Context, orderID, code, provider, nextStatus string) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE orders SET pickup_code=$2, payment_provider=$3, status=$4, updated_at=now() WHERE id=$1`,
		orderID, code, provider, nextStatus)
	return err
}

func (s *Store) FindByPickupCode(ctx context.Context, code string) (*models.Order, error) {
	var id string
	err := s.Pool.QueryRow(ctx, `
		SELECT id FROM orders
		WHERE pickup_code=$1 AND status='with_courier'
		LIMIT 1`, code).Scan(&id)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return s.Order(ctx, id)
}

func (s *Store) CodeExists(ctx context.Context, code string) (bool, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM orders WHERE pickup_code=$1 AND status NOT IN ('issued','cancelled')`, code).Scan(&n)
	return n > 0, err
}

func (s *Store) DuePaymentOrders(ctx context.Context) ([]models.Order, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id FROM orders
		WHERE status='awaiting_payment' AND payment_deadline_at IS NOT NULL AND payment_deadline_at < now()`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Order
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		o, err := s.Order(ctx, id)
		if err != nil {
			return nil, err
		}
		if o != nil {
			out = append(out, *o)
		}
	}
	if out == nil {
		out = []models.Order{}
	}
	return out, rows.Err()
}

func (s *Store) AddLeftovers(ctx context.Context, o models.Order) error {
	for _, it := range o.Items {
		var lid string
		if err := s.Pool.QueryRow(ctx, `
			INSERT INTO warehouse_leftovers (group_buy_id, order_id, title, quantity, reason)
			VALUES ($1,$2,$3,$4,'unpaid') RETURNING id`, it.GroupBuyID, o.ID, it.Title, it.Quantity).Scan(&lid); err != nil {
			return err
		}
		pid := ""
		if it.ProductID != nil {
			pid = *it.ProductID
		}
		if pid == "" {
			pid, _ = s.ProductIDByGroupBuy(ctx, it.GroupBuyID)
		}
		if pid != "" {
			_ = s.MoveStock(ctx, pid, "in", it.Quantity, "To‘lanmagan qoldiq", "leftover", lid, "")
		}
	}
	return nil
}

func (s *Store) Leftovers(ctx context.Context) ([]models.Leftover, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, group_buy_id, title, quantity, reason, created_at
		FROM warehouse_leftovers ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Leftover
	for rows.Next() {
		var l models.Leftover
		if err := rows.Scan(&l.ID, &l.GroupBuyID, &l.Title, &l.Quantity, &l.Reason, &l.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	if out == nil {
		out = []models.Leftover{}
	}
	return out, rows.Err()
}

func (s *Store) CreatePayment(ctx context.Context, p *models.Payment) error {
	return s.Pool.QueryRow(ctx, `
		INSERT INTO payments (order_id, provider, amount_uzs, status, checkout_url)
		VALUES ($1,$2,$3,'pending',$4) RETURNING id`,
		p.OrderID, p.Provider, p.AmountUzs, p.CheckoutURL).Scan(&p.ID)
}

func (s *Store) Payment(ctx context.Context, id string) (*models.Payment, error) {
	p := &models.Payment{}
	err := s.Pool.QueryRow(ctx, `
		SELECT id, order_id, provider, amount_uzs, status, COALESCE(checkout_url,'') FROM payments WHERE id=$1`, id).Scan(
		&p.ID, &p.OrderID, &p.Provider, &p.AmountUzs, &p.Status, &p.CheckoutURL)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return p, err
}

func (s *Store) MarkPaymentPaid(ctx context.Context, id string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE payments SET status='paid', paid_at=now() WHERE id=$1`, id)
	return err
}

func (s *Store) PaidOrdersForGroupBuy(ctx context.Context, gbID string) (int, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT o.id) FROM orders o
		JOIN order_items oi ON oi.order_id=o.id
		WHERE oi.group_buy_id=$1 AND o.status IN ('with_courier','issued')`, gbID).Scan(&n)
	return n, err
}

func (s *Store) Stats(ctx context.Context) (map[string]any, error) {
	out := map[string]any{}
	var customers, couriers, openGB, awaiting int
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role='customer'`).Scan(&customers)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role='courier'`).Scan(&couriers)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM group_buys WHERE status IN ('open','closed')`).Scan(&openGB)
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE status IN ('collecting','awaiting_courier','with_courier')`).Scan(&awaiting)
	out["customers"] = customers
	out["couriers"] = couriers
	out["activeCollections"] = openGB
	out["openOrders"] = awaiting
	var products int
	_ = s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM products`).Scan(&products)
	out["products"] = products
	return out, nil
}

func (s *Store) MaybeCompleteGroupBuys(ctx context.Context) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE group_buys SET status='completed', updated_at=now()
		WHERE status='in_fulfillment'
		  AND NOT EXISTS (
		    SELECT 1 FROM order_items oi
		    JOIN orders o ON o.id=oi.order_id
		    WHERE oi.group_buy_id=group_buys.id AND o.status IN ('collecting','awaiting_courier','with_courier')
		  )`)
	return err
}
