ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_yigim_id_fkey;

-- Restore NOT NULL only for rows that still have yigim_id
UPDATE order_items SET yigim_id = (
  SELECT y.id FROM yigims y LIMIT 1
) WHERE yigim_id IS NULL;

ALTER TABLE order_items
  ALTER COLUMN yigim_id SET NOT NULL;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_yigim_id_fkey
  FOREIGN KEY (yigim_id) REFERENCES yigims(id) ON DELETE RESTRICT;

ALTER TABLE yigims
  DROP CONSTRAINT IF EXISTS yigims_product_id_fkey;

ALTER TABLE yigims
  ADD CONSTRAINT yigims_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE yigim_items
  DROP CONSTRAINT IF EXISTS yigim_items_product_id_fkey;

UPDATE yigim_items SET product_id = (
  SELECT p.id FROM products p LIMIT 1
) WHERE product_id IS NULL;

ALTER TABLE yigim_items
  ALTER COLUMN product_id SET NOT NULL;

ALTER TABLE yigim_items
  ADD CONSTRAINT yigim_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
