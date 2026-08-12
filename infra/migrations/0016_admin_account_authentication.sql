BEGIN;

CREATE TABLE IF NOT EXISTS admin_accounts (
  account_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  credential_version BIGINT NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (account_id ~ '^adm_[a-f0-9]{32}$'),
  CHECK (username ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  CHECK (char_length(username) BETWEEN 3 AND 64),
  CHECK (password_hash ~ '^scrypt\\$v1\\$')
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_accounts_single_enabled_idx
  ON admin_accounts ((enabled)) WHERE enabled = TRUE;

COMMIT;
