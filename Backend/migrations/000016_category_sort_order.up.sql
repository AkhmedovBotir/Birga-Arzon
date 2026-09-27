ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

ALTER TABLE subcategories
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS categories_sort_order_idx ON categories (sort_order);
CREATE INDEX IF NOT EXISTS subcategories_sort_order_idx ON subcategories (sort_order);
