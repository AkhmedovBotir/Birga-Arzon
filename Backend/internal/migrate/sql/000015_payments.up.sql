ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
    ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS atmos_payment_id TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS atmos_invoice TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT orders_payment_status_check
            CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'cod'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    request_id      TEXT NOT NULL UNIQUE,
    payment_id      TEXT NOT NULL DEFAULT '',
    token           TEXT NOT NULL DEFAULT '',
    amount          NUMERIC(14, 2) NOT NULL DEFAULT 0,
    amount_tiyin    BIGINT NOT NULL DEFAULT 0,
    method          TEXT NOT NULL DEFAULT 'card',
    status          TEXT NOT NULL DEFAULT 'created',
    checkout_url    TEXT NOT NULL DEFAULT '',
    callback_payload JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments (order_id);
CREATE INDEX IF NOT EXISTS payments_payment_id_idx ON payments (payment_id);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders (payment_status);

INSERT INTO app_settings (key, value)
VALUES ('delivery_fee', '8000')
ON CONFLICT (key) DO NOTHING;
