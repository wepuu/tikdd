BEGIN;

CREATE TABLE IF NOT EXISTS provider_rollout_rules (
  rule_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  allocation_bps INTEGER NOT NULL CHECK (allocation_bps BETWEEN 0 AND 10000),
  revision BIGINT NOT NULL CHECK (revision > 0),
  activates_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  change_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (rule_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  CHECK (provider_id = '*' OR provider_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  CHECK (platform = '*' OR platform ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CHECK (region = '*' OR region ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CHECK (enabled OR allocation_bps = 0),
  CHECK (provider_id <> '*' OR NOT enabled),
  CHECK (expires_at IS NULL OR expires_at > activates_at),
  CHECK (char_length(change_reason) BETWEEN 1 AND 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_rollout_rules_selector_idx
  ON provider_rollout_rules (provider_id, platform, region);

CREATE TABLE IF NOT EXISTS provider_rollout_rule_audit (
  id BIGSERIAL PRIMARY KEY,
  rule_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  previous_revision BIGINT,
  new_revision BIGINT NOT NULL CHECK (new_revision > 0),
  before_rule JSONB,
  after_rule JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (operator_id ~ '^[a-zA-Z0-9]+([._:@-][a-zA-Z0-9]+)*$'),
  CHECK (char_length(operator_id) BETWEEN 1 AND 128),
  CHECK (char_length(reason) BETWEEN 1 AND 500),
  CHECK (previous_revision IS NULL OR previous_revision > 0),
  CHECK (previous_revision IS NULL OR new_revision = previous_revision + 1)
);

CREATE INDEX IF NOT EXISTS provider_rollout_rule_audit_rule_idx
  ON provider_rollout_rule_audit (rule_id, id DESC);

COMMIT;
