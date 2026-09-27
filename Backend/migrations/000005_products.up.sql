CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    subcategory_id  UUID NOT NULL REFERENCES subcategories(id) ON DELETE RESTRICT,
    name            TEXT NOT NULL,
    description     JSONB NOT NULL DEFAULT '{"ops":[{"insert":"\n"}]}'::jsonb,
    unit            TEXT NOT NULL CHECK (unit IN ('dona', 'litr', 'kg')),
    unit_size       NUMERIC(12, 3) NOT NULL DEFAULT 1 CHECK (unit_size > 0),
    stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    price           BIGINT NOT NULL CHECK (price >= 0),
    images          TEXT[] NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT products_images_len_chk CHECK (cardinality(images) >= 1 AND cardinality(images) <= 5)
);

CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_subcategory_id_idx ON products (subcategory_id);
CREATE INDEX IF NOT EXISTS products_status_idx ON products (status);
CREATE INDEX IF NOT EXISTS products_name_idx ON products (name);
