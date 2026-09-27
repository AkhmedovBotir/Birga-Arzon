CREATE TABLE IF NOT EXISTS yigims (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type         TEXT NOT NULL CHECK (type IN ('single', 'combo')),
    name         TEXT,
    product_id   UUID REFERENCES products(id) ON DELETE RESTRICT,
    target_qty   INTEGER NOT NULL CHECK (target_qty > 0),
    images       TEXT[] NOT NULL DEFAULT '{}',
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT yigims_images_len_chk CHECK (cardinality(images) >= 1 AND cardinality(images) <= 5),
    CONSTRAINT yigims_single_product_chk CHECK (
        (type = 'single' AND product_id IS NOT NULL) OR
        (type = 'combo' AND product_id IS NULL AND name IS NOT NULL AND length(trim(name)) > 0)
    )
);

CREATE TABLE IF NOT EXISTS yigim_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    yigim_id    UUID NOT NULL REFERENCES yigims(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    qty         INTEGER NOT NULL CHECK (qty > 0),
    UNIQUE (yigim_id, product_id)
);

CREATE INDEX IF NOT EXISTS yigims_type_idx ON yigims (type);
CREATE INDEX IF NOT EXISTS yigims_status_idx ON yigims (status);
CREATE INDEX IF NOT EXISTS yigims_product_id_idx ON yigims (product_id);
CREATE INDEX IF NOT EXISTS yigim_items_yigim_id_idx ON yigim_items (yigim_id);
