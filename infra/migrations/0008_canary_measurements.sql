BEGIN;

CREATE TABLE IF NOT EXISTS provider_canary_measurements (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL,
  canary_id TEXT NOT NULL CHECK (canary_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  provider_id TEXT NOT NULL CHECK (provider_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  platform TEXT NOT NULL CHECK (platform ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  region TEXT NOT NULL CHECK (region ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),
  failure_code TEXT,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  format_count INTEGER CHECK (format_count IS NULL OR format_count >= 0),
  link_lifetime_ms BIGINT CHECK (link_lifetime_ms IS NULL OR link_lifetime_ms >= 0),
  attempt_count SMALLINT NOT NULL CHECK (attempt_count BETWEEN 0 AND 100),
  fallback_depth SMALLINT NOT NULL CHECK (fallback_depth BETWEEN 0 AND 99),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (run_id, canary_id),
  CHECK (expires_at > recorded_at),
  CHECK (
    (status = 'succeeded' AND failure_code IS NULL AND format_count IS NOT NULL)
    OR (status = 'failed' AND failure_code IS NOT NULL AND format_count IS NULL)
  ),
  CHECK (fallback_depth = GREATEST(attempt_count - 1, 0))
);

CREATE INDEX IF NOT EXISTS provider_canary_measurements_route_time_idx
  ON provider_canary_measurements (provider_id, platform, region, recorded_at DESC);
CREATE INDEX IF NOT EXISTS provider_canary_measurements_cleanup_expiry_idx
  ON provider_canary_measurements (expires_at, id);

COMMIT;
