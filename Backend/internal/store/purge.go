package store

import (
	"context"

	"github.com/jackc/pgx/v5"
)

func queryIDs(ctx context.Context, tx pgx.Tx, q string, args ...any) ([]string, error) {
	rows, err := tx.Query(ctx, q, args...)
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
	if ids == nil {
		ids = []string{}
	}
	return ids, rows.Err()
}

func deleteEmptyOrdersTx(ctx context.Context, tx pgx.Tx, orderIDs []string) error {
	if len(orderIDs) == 0 {
		return nil
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM warehouse_leftovers
		WHERE order_id = ANY($1::uuid[])
		  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = warehouse_leftovers.order_id)`, orderIDs); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		DELETE FROM orders o
		WHERE o.id = ANY($1::uuid[])
		  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)`, orderIDs)
	return err
}

func purgeGroupBuysTx(ctx context.Context, tx pgx.Tx, gbIDs []string) error {
	if len(gbIDs) == 0 {
		return nil
	}
	orderIDs, err := queryIDs(ctx, tx, `
		SELECT DISTINCT order_id FROM order_items WHERE group_buy_id = ANY($1::uuid[])`, gbIDs)
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM warehouse_leftovers WHERE group_buy_id = ANY($1::uuid[])`, gbIDs); err != nil {
		return err
	}
	if len(orderIDs) > 0 {
		if _, err := tx.Exec(ctx, `DELETE FROM warehouse_leftovers WHERE order_id = ANY($1::uuid[])`, orderIDs); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM order_items WHERE group_buy_id = ANY($1::uuid[])`, gbIDs); err != nil {
		return err
	}
	if err := deleteEmptyOrdersTx(ctx, tx, orderIDs); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM cart_items WHERE group_buy_id = ANY($1::uuid[])`, gbIDs); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `DELETE FROM group_buys WHERE id = ANY($1::uuid[])`, gbIDs)
	return err
}

func purgeProductsTx(ctx context.Context, tx pgx.Tx, productIDs []string) error {
	if len(productIDs) == 0 {
		return nil
	}
	gbIDs, err := queryIDs(ctx, tx, `SELECT id FROM group_buys WHERE product_id = ANY($1::uuid[])
		UNION
		SELECT group_buy_id FROM group_buy_items WHERE product_id = ANY($1::uuid[])`, productIDs)
	if err != nil {
		return err
	}
	if err := purgeGroupBuysTx(ctx, tx, gbIDs); err != nil {
		return err
	}
	orderIDs, err := queryIDs(ctx, tx, `
		SELECT DISTINCT order_id FROM order_items WHERE product_id = ANY($1::uuid[])`, productIDs)
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM order_items WHERE product_id = ANY($1::uuid[])`, productIDs); err != nil {
		return err
	}
	if err := deleteEmptyOrdersTx(ctx, tx, orderIDs); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `DELETE FROM products WHERE id = ANY($1::uuid[])`, productIDs)
	return err
}
