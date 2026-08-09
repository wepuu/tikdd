BEGIN;

CREATE TABLE IF NOT EXISTS resolve_task_idempotency (
  key_digest BYTEA PRIMARY KEY,
  request_fingerprint BYTEA NOT NULL,
  task_id TEXT NOT NULL UNIQUE REFERENCES resolve_tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (octet_length(key_digest) = 32),
  CHECK (octet_length(request_fingerprint) = 32),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS resolve_task_idempotency_expiry_idx
  ON resolve_task_idempotency (expires_at);

CREATE TABLE IF NOT EXISTS active_source_admissions (
  source_fingerprint BYTEA PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE REFERENCES resolve_tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (octet_length(source_fingerprint) = 32),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS active_source_admissions_expiry_idx
  ON active_source_admissions (expires_at);

COMMIT;
