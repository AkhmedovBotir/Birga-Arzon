ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS user_profiles_is_blocked_idx ON user_profiles (is_blocked);
