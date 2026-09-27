DROP INDEX IF EXISTS user_profiles_is_blocked_idx;
ALTER TABLE user_profiles
    DROP COLUMN IF EXISTS is_blocked;
