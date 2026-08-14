BEGIN;

ALTER TABLE admin_route_policy_revisions
  ADD COLUMN IF NOT EXISTS traffic_shares JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE admin_route_policy_revisions
  DROP CONSTRAINT IF EXISTS admin_route_policy_revisions_traffic_shares_check;
ALTER TABLE admin_route_policy_revisions
  ADD CONSTRAINT admin_route_policy_revisions_traffic_shares_check
  CHECK (
    jsonb_typeof(traffic_shares) = 'array'
    AND jsonb_array_length(traffic_shares) <= 16
  );

COMMIT;
