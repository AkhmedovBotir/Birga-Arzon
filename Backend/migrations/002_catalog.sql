-- 002 catalog, geo source ids, stock

CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_oid TEXT UNIQUE,
    name TEXT NOT NULL,
    code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cities ADD COLUMN IF NOT EXISTS source_oid TEXT;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id) ON DELETE SET NULL;
DROP INDEX IF EXISTS cities_source_oid_uidx;
ALTER TABLE cities DROP CONSTRAINT IF EXISTS cities_source_oid_key;
DO $$ BEGIN
    ALTER TABLE cities ADD CONSTRAINT cities_source_oid_key UNIQUE (source_oid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE mfys ADD COLUMN IF NOT EXISTS source_oid TEXT;
DROP INDEX IF EXISTS mfys_source_oid_uidx;
ALTER TABLE mfys DROP CONSTRAINT IF EXISTS mfys_source_oid_key;
DO $$ BEGIN
    ALTER TABLE mfys ADD CONSTRAINT mfys_source_oid_key UNIQUE (source_oid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE cities DROP CONSTRAINT IF EXISTS cities_name_key;
ALTER TABLE mfys DROP CONSTRAINT IF EXISTS mfys_city_id_name_key;

ALTER TABLE users ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subcategory_id UUID NOT NULL REFERENCES subcategories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    unit_label TEXT NOT NULL DEFAULT 'kg',
    unit_price_uzs BIGINT NOT NULL DEFAULT 0,
    photo_url TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('in', 'out')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    note TEXT NOT NULL DEFAULT '',
    ref_type TEXT,
    ref_id UUID,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE group_buys ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

CREATE INDEX IF NOT EXISTS stock_moves_product_idx ON stock_moves (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS products_sub_idx ON products (subcategory_id);
CREATE INDEX IF NOT EXISTS cities_region_idx ON cities (region_id);
