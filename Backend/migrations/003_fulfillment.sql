-- Fulfillment flow: admin closes collection, courier accepts, then pickup code.

ALTER TABLE group_buys DROP CONSTRAINT IF EXISTS group_buys_status_check;
UPDATE group_buys SET status = 'closed' WHERE status IN ('ready_for_payment');
ALTER TABLE group_buys ADD CONSTRAINT group_buys_status_check
    CHECK (status IN ('open', 'closed', 'in_fulfillment', 'completed', 'cancelled'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
UPDATE orders SET status = 'awaiting_courier' WHERE status = 'awaiting_payment';
UPDATE orders SET status = 'with_courier'
    WHERE status IN ('paid', 'pay_on_delivery', 'ready_for_pickup', 'out_for_delivery');
ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('collecting', 'awaiting_courier', 'with_courier', 'issued', 'cancelled'));
