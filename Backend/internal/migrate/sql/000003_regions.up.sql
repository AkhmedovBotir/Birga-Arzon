-- Hududlar: viloyat / tuman / mfy (additive only)
CREATE TABLE IF NOT EXISTS regions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    code        TEXT NOT NULL DEFAULT '',
    type        TEXT NOT NULL CHECK (type IN ('viloyat', 'tuman', 'mfy')),
    parent_id   UUID REFERENCES regions(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT regions_legacy_id_unique UNIQUE (legacy_id)
);

CREATE INDEX IF NOT EXISTS regions_parent_id_idx ON regions (parent_id);
CREATE INDEX IF NOT EXISTS regions_type_idx ON regions (type);
CREATE INDEX IF NOT EXISTS regions_name_idx ON regions (name);
