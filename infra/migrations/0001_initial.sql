BEGIN;

CREATE TABLE IF NOT EXISTS resolve_tasks (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN (
    'queued', 'detecting', 'resolving', 'succeeded', 'failed', 'expired'
  )),
  platform TEXT NOT NULL CHECK (platform ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  canonical_url TEXT NOT NULL,
  result JSONB,
  error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS resolve_tasks_expiry_idx ON resolve_tasks (expires_at);
CREATE INDEX IF NOT EXISTS resolve_tasks_status_created_idx ON resolve_tasks (status, created_at);

COMMIT;
