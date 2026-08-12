BEGIN;

ALTER TABLE admin_route_policy_revisions
  ADD COLUMN IF NOT EXISTS staged_allocations JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE admin_route_policy_revisions
  DROP CONSTRAINT IF EXISTS admin_route_policy_revisions_staged_allocations_check;
ALTER TABLE admin_route_policy_revisions
  ADD CONSTRAINT admin_route_policy_revisions_staged_allocations_check
  CHECK (
    jsonb_typeof(staged_allocations) = 'array'
    AND jsonb_array_length(staged_allocations) <= 16
  );

CREATE SEQUENCE IF NOT EXISTS admin_route_policy_projection_revision_seq;

CREATE TABLE IF NOT EXISTS admin_route_policy_projection_heads (
  deployment TEXT NOT NULL,
  region TEXT NOT NULL,
  durable_revision BIGINT NOT NULL CHECK (durable_revision > 0),
  projected_revision BIGINT,
  state TEXT NOT NULL CHECK (state IN ('propagating', 'propagated', 'propagation_failed')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (deployment, region),
  CHECK (deployment ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CHECK (region ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CHECK (projected_revision IS NULL OR projected_revision > 0),
  CHECK (state <> 'propagated' OR projected_revision = durable_revision)
);

COMMIT;
