-- DocCheck v1 migration
-- Run ONE statement at a time via RDS Query Editor. Verify each succeeds before the next.

-- Statement 1: add is_admin column to travelers
ALTER TABLE travelers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Statement 2: create doccheck_requests table
CREATE TABLE IF NOT EXISTS doccheck_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_uuid UUID NOT NULL REFERENCES travelers(uuid),
  trip_id UUID REFERENCES trips(id),
  trip_group_id TEXT,
  nationality VARCHAR(10),
  passport_issuing_country VARCHAR(10),
  passport_expiry DATE,
  destination_iata VARCHAR(10),
  transit_iatas JSONB NOT NULL DEFAULT '[]'::jsonb,
  departure_date DATE,
  return_date DATE,
  travel_purpose VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','reviewed')),
  result VARCHAR(20) CHECK (result IN ('clear','conditional','action_needed')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES travelers(uuid),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
