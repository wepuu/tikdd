BEGIN;

CREATE TABLE IF NOT EXISTS operational_service_status (
  service TEXT NOT NULL CHECK (service IN ('canary', 'evidence', 'cleanup')),
  deployment TEXT NOT NULL CHECK (deployment ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
  run_id TEXT NOT NULL CHECK (char_length(run_id) BETWEEN 1 AND 128),
  state TEXT NOT NULL CHECK (state IN ('running', 'completed', 'degraded', 'failed', 'lease_unavailable')),
  lease_state TEXT NOT NULL CHECK (lease_state IN ('acquired', 'unavailable', 'released', 'unknown')),
  last_started_at TIMESTAMPTZ,
  last_finished_at TIMESTAMPTZ,
  next_expected_at TIMESTAMPTZ NOT NULL,
  stale_after_at TIMESTAMPTZ NOT NULL,
  consecutive_failures SMALLINT NOT NULL DEFAULT 0 CHECK (consecutive_failures BETWEEN 0 AND 10),
  last_error_code TEXT CHECK (last_error_code IS NULL OR last_error_code IN (
    'startup_failure', 'runtime_failure', 'persistence_failure', 'lease_unavailable', 'lease_release_failure'
  )),
  sanitized_summary JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(sanitized_summary) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (service, deployment),
  CHECK (stale_after_at >= next_expected_at),
  CHECK (last_finished_at IS NULL OR last_started_at IS NULL OR last_finished_at >= last_started_at)
);

CREATE INDEX IF NOT EXISTS operational_service_status_freshness_idx
  ON operational_service_status (deployment, stale_after_at, service);

-- The actual production ops_database_url role was inspected before this migration: tikdd_ops.
-- Keep the grant narrow and conditional so local databases without production roles remain runnable.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tikdd_ops') THEN
    REVOKE ALL PRIVILEGES ON TABLE operational_service_status FROM tikdd_ops;
    GRANT SELECT, INSERT, UPDATE ON TABLE operational_service_status TO tikdd_ops;
  END IF;
END
$migration$;

COMMIT;
