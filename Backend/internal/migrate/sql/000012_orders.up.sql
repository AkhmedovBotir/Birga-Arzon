CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'waiting',
    delivery_code   TEXT NOT NULL,
    kuryer_id       UUID REFERENCES kuryers(id) ON DELETE SET NULL,
    first_name      TEXT NOT NULL DEFAULT '',
    last_name       TEXT NOT NULL DEFAULT '',
    phone           TEXT NOT NULL DEFAULT '',
    viloyat_id      UUID REFERENCES regions(id) ON DELETE SET NULL,
    tuman_id        UUID REFERENCES regions(id) ON DELETE SET NULL,
    viloyat_name    TEXT NOT NULL DEFAULT '',
    tuman_name      TEXT NOT NULL DEFAULT '',
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    total_amount    NUMERIC(14, 2) NOT NULL DEFAULT 0,
    note            TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_at     TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    CONSTRAINT orders_status_check CHECK (
        status IN ('waiting', 'ready', 'assigned', 'delivered', 'cancelled')
    )
);

CREATE TABLE IF NOT EXISTS order_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    yigim_id      UUID NOT NULL REFERENCES yigims(id) ON DELETE RESTRICT,
    product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name  TEXT NOT NULL DEFAULT '',
    unit          TEXT NOT NULL DEFAULT 'dona',
    unit_price    NUMERIC(14, 2) NOT NULL DEFAULT 0,
    qty           INT NOT NULL CHECK (qty > 0),
    image         TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_kuryer_id_idx ON orders (kuryer_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_yigim_id_idx ON order_items (yigim_id);
