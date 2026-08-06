BEGIN;

CREATE TABLE IF NOT EXISTS delivery_candidates (
  id TEXT PRIMARY KEY CHECK (id ~ '^dvc_[a-f0-9]{32}$'),
  task_id TEXT NOT NULL REFERENCES resolve_tasks(id) ON DELETE CASCADE,
  format_id TEXT NOT NULL CHECK (
    char_length(format_id) BETWEEN 1 AND 160
    AND format_id ~ '^[A-Za-z0-9._-]+$'
  ),
  provider_id TEXT NOT NULL CHECK (
    char_length(provider_id) BETWEEN 1 AND 100
    AND provider_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  mode TEXT NOT NULL CHECK (mode IN ('redirect', 'proxy', 'temporary-object')),
  host_policy_id TEXT NOT NULL CHECK (
    char_length(host_policy_id) BETWEEN 1 AND 100
    AND host_policy_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  encryption_algorithm TEXT NOT NULL CHECK (encryption_algorithm = 'aes-256-gcm'),
  encryption_key_id TEXT NOT NULL CHECK (
    char_length(encryption_key_id) BETWEEN 1 AND 100
    AND encryption_key_id ~ '^[A-Za-z0-9]+([._:/-][A-Za-z0-9]+)*$'
  ),
  encryption_iv BYTEA NOT NULL CHECK (octet_length(encryption_iv) = 12),
  encrypted_payload BYTEA NOT NULL CHECK (octet_length(encrypted_payload) BETWEEN 1 AND 65536),
  authentication_tag BYTEA NOT NULL CHECK (octet_length(authentication_tag) = 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (task_id, format_id),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS delivery_candidates_expiry_idx
  ON delivery_candidates (expires_at);
CREATE INDEX IF NOT EXISTS delivery_candidates_provider_idx
  ON delivery_candidates (provider_id, host_policy_id, created_at DESC);

CREATE TABLE IF NOT EXISTS delivery_tickets (
  id TEXT PRIMARY KEY CHECK (id ~ '^dtk_[a-f0-9]{32}$'),
  candidate_id TEXT NOT NULL REFERENCES delivery_candidates(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('redirect', 'proxy', 'temporary-object')),
  token_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  CHECK (expires_at > created_at),
  CHECK (redeemed_at IS NULL OR redeemed_at >= created_at)
);

CREATE INDEX IF NOT EXISTS delivery_tickets_expiry_idx
  ON delivery_tickets (expires_at);
CREATE INDEX IF NOT EXISTS delivery_tickets_active_candidate_idx
  ON delivery_tickets (candidate_id, expires_at)
  WHERE redeemed_at IS NULL;

COMMIT;
