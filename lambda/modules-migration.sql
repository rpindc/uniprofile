CREATE TABLE IF NOT EXISTS traveler_profile_modules (
  traveler_uuid UUID        NOT NULL,
  module_name   VARCHAR(50) NOT NULL,
  data          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at    TIMESTAMPTZ          DEFAULT NOW(),
  PRIMARY KEY (traveler_uuid, module_name)
);
CREATE INDEX IF NOT EXISTS idx_tpm_traveler ON traveler_profile_modules (traveler_uuid);
