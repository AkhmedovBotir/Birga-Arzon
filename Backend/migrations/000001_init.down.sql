-- Down is intentionally conservative: only drop empty module placeholder tables
-- if they exist. Prefer forward-fix migrations in production.
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS kuryer_profiles;
DROP TABLE IF EXISTS admin_profiles;
DROP TABLE IF EXISTS schema_meta;
