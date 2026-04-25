-- UniProfile: Groups table
-- Run once against your Aurora PostgreSQL instance before deploying the updated Lambda.

CREATE TABLE IF NOT EXISTS traveler_groups (
  id           TEXT        NOT NULL,
  owner_uuid   UUID        NOT NULL REFERENCES travelers(uuid) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT '',
  type         TEXT        NOT NULL DEFAULT 'other',
  destination  TEXT,
  dep          DATE,
  ret          DATE,
  members      JSONB       NOT NULL DEFAULT '[]',
  flights      JSONB       NOT NULL DEFAULT '[]',
  hotel        JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY  (id, owner_uuid)
);

CREATE INDEX IF NOT EXISTS idx_traveler_groups_owner ON traveler_groups (owner_uuid, updated_at DESC);
