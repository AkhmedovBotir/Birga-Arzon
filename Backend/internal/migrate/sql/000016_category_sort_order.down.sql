DROP INDEX IF EXISTS subcategories_sort_order_idx;
DROP INDEX IF EXISTS categories_sort_order_idx;

ALTER TABLE subcategories
    DROP COLUMN IF EXISTS sort_order;

ALTER TABLE categories
    DROP COLUMN IF EXISTS sort_order;
