CREATE TABLE IF NOT EXISTS kuryers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name    TEXT NOT NULL DEFAULT '',
    last_name     TEXT NOT NULL DEFAULT '',
    phone         TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    viloyat_id    UUID REFERENCES regions(id) ON DELETE SET NULL,
    tuman_id      UUID REFERENCES regions(id) ON DELETE SET NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT kuryers_phone_unique UNIQUE (phone)
);

CREATE INDEX IF NOT EXISTS kuryers_phone_idx ON kuryers (phone);
CREATE INDEX IF NOT EXISTS kuryers_viloyat_id_idx ON kuryers (viloyat_id);
CREATE INDEX IF NOT EXISTS kuryers_is_active_idx ON kuryers (is_active);
