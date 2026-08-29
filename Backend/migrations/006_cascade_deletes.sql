-- Catalog and group-buy deletes must not be blocked by leftover FKs.

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_subcategory_id_fkey;
ALTER TABLE products
  ADD CONSTRAINT products_subcategory_id_fkey
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE;

ALTER TABLE group_buys DROP CONSTRAINT IF EXISTS group_buys_product_id_fkey;
ALTER TABLE group_buys
  ADD CONSTRAINT group_buys_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items
  ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_group_buy_id_fkey;
ALTER TABLE order_items
  ADD CONSTRAINT order_items_group_buy_id_fkey
  FOREIGN KEY (group_buy_id) REFERENCES group_buys(id) ON DELETE CASCADE;

ALTER TABLE warehouse_leftovers DROP CONSTRAINT IF EXISTS warehouse_leftovers_group_buy_id_fkey;
ALTER TABLE warehouse_leftovers
  ADD CONSTRAINT warehouse_leftovers_group_buy_id_fkey
  FOREIGN KEY (group_buy_id) REFERENCES group_buys(id) ON DELETE CASCADE;

ALTER TABLE warehouse_leftovers DROP CONSTRAINT IF EXISTS warehouse_leftovers_order_id_fkey;
ALTER TABLE warehouse_leftovers
  ADD CONSTRAINT warehouse_leftovers_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
