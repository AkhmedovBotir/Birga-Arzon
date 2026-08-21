CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mfys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pickup_address TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (city_id, name)
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL CHECK (role IN ('admin', 'courier', 'customer')),
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    city_id UUID REFERENCES cities(id),
    mfy_id UUID REFERENCES mfys(id),
    delivery_lat DOUBLE PRECISION,
    delivery_lng DOUBLE PRECISION,
    delivery_address TEXT,
    telegram_id BIGINT UNIQUE,
    profile_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_codes_phone_idx ON otp_codes (phone, created_at DESC);

CREATE TABLE IF NOT EXISTS group_buys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    photo_url TEXT,
    unit_label TEXT NOT NULL DEFAULT 'kg',
    unit_price_uzs BIGINT NOT NULL CHECK (unit_price_uzs >= 0),
    min_volume INTEGER NOT NULL CHECK (min_volume > 0),
    current_volume INTEGER NOT NULL DEFAULT 0 CHECK (current_volume >= 0),
    status TEXT NOT NULL CHECK (status IN ('open', 'ready_for_payment', 'in_fulfillment', 'completed', 'cancelled')),
    cash_on_delivery_allowed BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_buys_status_idx ON group_buys (status);

CREATE TABLE IF NOT EXISTS cart_items (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_buy_id UUID NOT NULL REFERENCES group_buys(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, group_buy_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    delivery_method TEXT NOT NULL CHECK (delivery_method IN ('pickup_mfy', 'home_delivery')),
    delivery_fee_uzs BIGINT NOT NULL DEFAULT 0,
    payment_provider TEXT CHECK (payment_provider IN ('click', 'payme', 'uzum', 'cash_on_delivery')),
    status TEXT NOT NULL CHECK (status IN (
        'collecting', 'awaiting_payment', 'paid', 'pay_on_delivery',
        'ready_for_pickup', 'out_for_delivery', 'issued', 'cancelled'
    )),
    pickup_code TEXT,
    payment_deadline_at TIMESTAMPTZ,
    city_id UUID REFERENCES cities(id),
    mfy_id UUID REFERENCES mfys(id),
    delivery_lat DOUBLE PRECISION,
    delivery_lng DOUBLE PRECISION,
    delivery_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE UNIQUE INDEX IF NOT EXISTS orders_active_pickup_code_idx ON orders (pickup_code)
    WHERE pickup_code IS NOT NULL AND status <> 'issued' AND status <> 'cancelled';

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    group_buy_id UUID NOT NULL REFERENCES group_buys(id),
    title TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_uzs BIGINT NOT NULL,
    unit_label TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS order_items_group_buy_idx ON order_items (group_buy_id);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    amount_uzs BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
    checkout_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS warehouse_leftovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_buy_id UUID NOT NULL REFERENCES group_buys(id),
    order_id UUID REFERENCES orders(id),
    title TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT 'unpaid',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);
