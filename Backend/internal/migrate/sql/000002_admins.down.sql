-- Conservative down: only drop admins table (explicit --force required by migrate CLI)
DROP INDEX IF EXISTS admins_role_idx;
DROP INDEX IF EXISTS admins_phone_idx;
DROP INDEX IF EXISTS admins_one_general;
DROP TABLE IF EXISTS admins;
