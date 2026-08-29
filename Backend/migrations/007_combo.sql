-- Combo collections: several products in one yig'im.

ALTER TABLE group_buys ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'product';

ALTER TABLE group_buys DROP CONSTRAINT IF EXISTS group_buys_kind_check;
ALTER TABLE group_buys ADD CONSTRAINT group_buys_kind_check
  CHECK (kind IN ('product', 'combo'));

CREATE TABLE IF NOT EXISTS group_buy_items (
    group_buy_id UUID NOT NULL REFERENCES group_buys(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (group_buy_id, product_id)
);

CREATE INDEX IF NOT EXISTS group_buy_items_product_idx ON group_buy_items (product_id);

INSERT INTO group_buy_items (group_buy_id, product_id, quantity)
SELECT id, product_id, 1
FROM group_buys
WHERE product_id IS NOT NULL
  AND kind = 'product'
ON CONFLICT DO NOTHING;
