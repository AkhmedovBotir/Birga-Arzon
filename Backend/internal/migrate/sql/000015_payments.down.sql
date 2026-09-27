DROP TABLE IF EXISTS payments;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders DROP COLUMN IF EXISTS delivery_fee;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_status;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_method;
ALTER TABLE orders DROP COLUMN IF EXISTS atmos_payment_id;
ALTER TABLE orders DROP COLUMN IF EXISTS atmos_invoice;
ALTER TABLE orders DROP COLUMN IF EXISTS paid_at;

DELETE FROM app_settings WHERE key = 'delivery_fee';
