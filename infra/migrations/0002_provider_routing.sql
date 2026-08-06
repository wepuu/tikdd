BEGIN;

ALTER TABLE resolve_tasks DROP CONSTRAINT IF EXISTS resolve_tasks_platform_check;
ALTER TABLE resolve_tasks ADD CONSTRAINT resolve_tasks_platform_check
  CHECK (platform ~ '^[a-z0-9]+(-[a-z0-9]+)*$') NOT VALID;
ALTER TABLE resolve_tasks VALIDATE CONSTRAINT resolve_tasks_platform_check;

CREATE TABLE IF NOT EXISTS provider_attempts (
  id BIGSERIAL PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES resolve_tasks(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  provider_kind TEXT NOT NULL CHECK (provider_kind IN ('api', 'site-adapter', 'yt-dlp', 'mock')),
  platform TEXT NOT NULL,
  priority SMALLINT NOT NULL CHECK (priority BETWEEN 0 AND 1000),
  route_score DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),
  failure_code TEXT,
  retryable BOOLEAN,
  fallback_allowed BOOLEAN,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS provider_attempts_task_idx
  ON provider_attempts (task_id, created_at);
CREATE INDEX IF NOT EXISTS provider_attempts_provider_health_idx
  ON provider_attempts (provider_id, platform, created_at DESC);

COMMIT;
