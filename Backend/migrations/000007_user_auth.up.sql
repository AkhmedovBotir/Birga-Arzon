-- Expand consumer profiles + OTP codes for phone auth
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS viloyat_id UUID REFERENCES regions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tuman_id UUID REFERENCES regions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS user_profiles_viloyat_id_idx ON user_profiles (viloyat_id);
CREATE INDEX IF NOT EXISTS user_profiles_tuman_id_idx ON user_profiles (tuman_id);

CREATE TABLE IF NOT EXISTS user_otps (
    phone       TEXT PRIMARY KEY,
    code        TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    attempts    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
