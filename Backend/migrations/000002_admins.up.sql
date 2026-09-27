-- Additive admins table for Admin module (safe: IF NOT EXISTS only)
CREATE TABLE IF NOT EXISTS admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name      TEXT NOT NULL DEFAULT '',
    last_name       TEXT NOT NULL DEFAULT '',
    phone           TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('general', 'admin')),
    username        TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES admins(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT admins_username_unique UNIQUE (username)
);

CREATE UNIQUE INDEX IF NOT EXISTS admins_one_general
    ON admins ((role))
    WHERE role = 'general';

CREATE INDEX IF NOT EXISTS admins_phone_idx ON admins (phone);
CREATE INDEX IF NOT EXISTS admins_role_idx ON admins (role);
