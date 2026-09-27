-- Allow deleting yigims even when referenced by order history.
ALTER TABLE order_items
  ALTER COLUMN yigim_id DROP NOT NULL;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_yigim_id_fkey;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_yigim_id_fkey
  FOREIGN KEY (yigim_id) REFERENCES yigims(id) ON DELETE SET NULL;

-- Products may be removed from catalog; keep yigim rows.
ALTER TABLE yigims
  DROP CONSTRAINT IF EXISTS yigims_product_id_fkey;

ALTER TABLE yigims
  ADD CONSTRAINT yigims_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE yigim_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE yigim_items
  DROP CONSTRAINT IF EXISTS yigim_items_product_id_fkey;

ALTER TABLE yigim_items
  ADD CONSTRAINT yigim_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- Categories/subcategories: products keep pointing — use SET NULL needs nullable cols.
-- Keep RESTRICT + soft-delete fallback in app for categories (products.category_id NOT NULL).
