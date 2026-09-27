DROP TABLE IF EXISTS user_otps;
DROP INDEX IF EXISTS user_profiles_tuman_id_idx;
DROP INDEX IF EXISTS user_profiles_viloyat_id_idx;
ALTER TABLE user_profiles
    DROP COLUMN IF EXISTS profile_complete,
    DROP COLUMN IF EXISTS lng,
    DROP COLUMN IF EXISTS lat,
    DROP COLUMN IF EXISTS tuman_id,
    DROP COLUMN IF EXISTS viloyat_id,
    DROP COLUMN IF EXISTS last_name,
    DROP COLUMN IF EXISTS first_name;
