BEGIN;

CREATE TABLE IF NOT EXISTS admin_route_policy_revisions (
  policy_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  revision_kind TEXT NOT NULL CHECK (revision_kind IN ('draft', 'published', 'rollback')),
  previous_revision BIGINT,
  ordered_provider_ids JSONB NOT NULL,
  rollout_rule_ids JSONB NOT NULL,
  concurrency_caps JSONB NOT NULL,
  reason TEXT NOT NULL,
  actor_subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (policy_id, revision),
  UNIQUE (platform, region, revision),
  CHECK (policy_id ~ '^rtp_[a-z0-9]+([._-][a-z0-9]+)*$'),
  CHECK (platform ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CHECK (region ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CHECK (previous_revision IS NULL OR previous_revision < revision),
  CHECK (jsonb_typeof(ordered_provider_ids) = 'array'),
  CHECK (jsonb_array_length(ordered_provider_ids) <= 16),
  CHECK (jsonb_typeof(rollout_rule_ids) = 'array'),
  CHECK (jsonb_array_length(rollout_rule_ids) <= 32),
  CHECK (jsonb_typeof(concurrency_caps) = 'array'),
  CHECK (jsonb_array_length(concurrency_caps) <= 16),
  CHECK (char_length(reason) BETWEEN 1 AND 500),
  CHECK (char_length(actor_subject) BETWEEN 1 AND 160)
);
CREATE INDEX IF NOT EXISTS admin_route_policy_revisions_tuple_idx
  ON admin_route_policy_revisions (platform, region, revision DESC);

CREATE TABLE IF NOT EXISTS admin_route_policy_heads (
  policy_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  head_revision BIGINT NOT NULL CHECK (head_revision > 0),
  draft_revision BIGINT,
  published_revision BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform, region),
  FOREIGN KEY (policy_id, head_revision)
    REFERENCES admin_route_policy_revisions (policy_id, revision),
  FOREIGN KEY (policy_id, draft_revision)
    REFERENCES admin_route_policy_revisions (policy_id, revision),
  FOREIGN KEY (policy_id, published_revision)
    REFERENCES admin_route_policy_revisions (policy_id, revision),
  CHECK (draft_revision IS NULL OR draft_revision <= head_revision),
  CHECK (published_revision IS NULL OR published_revision <= head_revision)
);

CREATE TABLE IF NOT EXISTS admin_platform_presentation_revisions (
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  public_availability TEXT NOT NULL CHECK (public_availability IN ('hidden', 'preview', 'listed', 'paused')),
  page_id TEXT,
  reason TEXT NOT NULL,
  actor_subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (platform, region, revision),
  CHECK (platform ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CHECK (region ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CHECK (page_id IS NULL OR page_id ~ '^page_[a-z0-9]+([._-][a-z0-9]+)*$'),
  CHECK (char_length(reason) BETWEEN 1 AND 500),
  CHECK (char_length(actor_subject) BETWEEN 1 AND 160)
);
CREATE TABLE IF NOT EXISTS admin_platform_presentation_heads (
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  head_revision BIGINT NOT NULL CHECK (head_revision > 0),
  draft_revision BIGINT,
  published_revision BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (platform, region),
  FOREIGN KEY (platform, region, head_revision)
    REFERENCES admin_platform_presentation_revisions (platform, region, revision),
  FOREIGN KEY (platform, region, draft_revision)
    REFERENCES admin_platform_presentation_revisions (platform, region, revision),
  FOREIGN KEY (platform, region, published_revision)
    REFERENCES admin_platform_presentation_revisions (platform, region, revision)
);

CREATE TABLE IF NOT EXISTS admin_locale_revisions (
  locale_tag TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  display_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('ltr', 'rtl')),
  fallback_locale_tag TEXT,
  enabled BOOLEAN NOT NULL,
  is_default BOOLEAN NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('draft', 'ready', 'published', 'archived')),
  reason TEXT NOT NULL,
  actor_subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (locale_tag, revision),
  CHECK (locale_tag ~ '^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$'),
  CHECK (fallback_locale_tag IS NULL OR fallback_locale_tag ~ '^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$'),
  CHECK (fallback_locale_tag IS NULL OR fallback_locale_tag <> locale_tag),
  CHECK (NOT is_default OR fallback_locale_tag IS NULL),
  CHECK (state <> 'published' OR enabled),
  CHECK (char_length(display_name) BETWEEN 1 AND 100),
  CHECK (char_length(reason) BETWEEN 1 AND 500),
  CHECK (char_length(actor_subject) BETWEEN 1 AND 160)
);
CREATE TABLE IF NOT EXISTS admin_locale_heads (
  locale_tag TEXT PRIMARY KEY,
  head_revision BIGINT NOT NULL CHECK (head_revision > 0),
  draft_revision BIGINT,
  published_revision BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (locale_tag, head_revision)
    REFERENCES admin_locale_revisions (locale_tag, revision),
  FOREIGN KEY (locale_tag, draft_revision)
    REFERENCES admin_locale_revisions (locale_tag, revision),
  FOREIGN KEY (locale_tag, published_revision)
    REFERENCES admin_locale_revisions (locale_tag, revision)
);
CREATE INDEX IF NOT EXISTS admin_locale_revisions_state_idx
  ON admin_locale_revisions (state, is_default, locale_tag, revision DESC);

INSERT INTO admin_locale_revisions (
  locale_tag, revision, display_name, direction, fallback_locale_tag, enabled, is_default, state,
  reason, actor_subject
) VALUES
  ('en', 1, 'English', 'ltr', NULL, TRUE, TRUE, 'published', 'Seed the reviewed default locale.', 'system_seed'),
  ('zh-CN', 1, '简体中文', 'ltr', 'en', TRUE, FALSE, 'published', 'Seed the reviewed Simplified Chinese locale.', 'system_seed')
ON CONFLICT (locale_tag, revision) DO NOTHING;
INSERT INTO admin_locale_heads (locale_tag, head_revision, draft_revision, published_revision)
VALUES ('en', 1, NULL, 1), ('zh-CN', 1, NULL, 1)
ON CONFLICT (locale_tag) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_page_revisions (
  page_id TEXT NOT NULL,
  locale_tag TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  page_type TEXT NOT NULL CHECK (page_type IN ('homepage', 'platform', 'guide', 'faq', 'legal')),
  platform TEXT,
  state TEXT NOT NULL CHECK (state IN ('draft', 'ready', 'published', 'archived')),
  content JSONB NOT NULL,
  seo JSONB NOT NULL,
  reason TEXT NOT NULL,
  actor_subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (page_id, locale_tag, revision),
  CHECK (page_id ~ '^page_[a-z0-9]+([._-][a-z0-9]+)*$'),
  CHECK (locale_tag ~ '^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$'),
  CHECK ((page_type = 'platform') = (platform IS NOT NULL)),
  CHECK (platform IS NULL OR platform ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CHECK (jsonb_typeof(content) = 'object'),
  CHECK (jsonb_typeof(seo) = 'object'),
  CHECK (char_length(reason) BETWEEN 1 AND 500),
  CHECK (char_length(actor_subject) BETWEEN 1 AND 160)
);
CREATE INDEX IF NOT EXISTS admin_page_revisions_locale_state_idx
  ON admin_page_revisions (locale_tag, state, page_type, page_id, revision DESC);
CREATE TABLE IF NOT EXISTS admin_page_heads (
  page_id TEXT NOT NULL,
  locale_tag TEXT NOT NULL,
  head_revision BIGINT NOT NULL CHECK (head_revision > 0),
  draft_revision BIGINT,
  published_revision BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (page_id, locale_tag),
  FOREIGN KEY (page_id, locale_tag, head_revision)
    REFERENCES admin_page_revisions (page_id, locale_tag, revision),
  FOREIGN KEY (page_id, locale_tag, draft_revision)
    REFERENCES admin_page_revisions (page_id, locale_tag, revision),
  FOREIGN KEY (page_id, locale_tag, published_revision)
    REFERENCES admin_page_revisions (page_id, locale_tag, revision)
);

CREATE TABLE IF NOT EXISTS admin_published_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  deployment TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  previous_snapshot_id TEXT REFERENCES admin_published_snapshots(snapshot_id) ON DELETE RESTRICT,
  schema_version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  propagation_state TEXT NOT NULL CHECK (propagation_state IN ('accepted', 'propagating', 'propagated', 'propagation_failed', 'rolled_back')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  propagated_at TIMESTAMPTZ,
  UNIQUE (deployment, revision),
  CHECK (snapshot_id ~ '^snap_[a-f0-9]{32}$'),
  CHECK (deployment ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CHECK (schema_version = '1'),
  CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  CHECK (jsonb_typeof(payload) = 'object'),
  CHECK (propagated_at IS NULL OR propagated_at >= created_at)
);
CREATE INDEX IF NOT EXISTS admin_published_snapshots_deployment_idx
  ON admin_published_snapshots (deployment, revision DESC);
CREATE TABLE IF NOT EXISTS admin_published_snapshot_heads (
  deployment TEXT PRIMARY KEY,
  revision BIGINT NOT NULL CHECK (revision > 0),
  active_snapshot_id TEXT NOT NULL REFERENCES admin_published_snapshots(snapshot_id) ON DELETE RESTRICT,
  previous_snapshot_id TEXT REFERENCES admin_published_snapshots(snapshot_id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_command_receipts (
  command_id TEXT PRIMARY KEY,
  idempotency_digest BYTEA NOT NULL UNIQUE,
  command_digest BYTEA NOT NULL,
  aggregate_kind TEXT NOT NULL CHECK (aggregate_kind IN ('route_policy', 'platform_presentation', 'locale', 'page', 'snapshot')),
  target_id TEXT NOT NULL,
  actor_subject TEXT NOT NULL,
  expected_revision BIGINT,
  accepted_revision BIGINT,
  current_revision BIGINT,
  propagated_revision BIGINT,
  state TEXT NOT NULL CHECK (state IN ('accepted', 'propagating', 'propagated', 'conflicted', 'failed', 'propagation_failed', 'rolled_back')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (command_id ~ '^cmd_[a-f0-9]{32}$'),
  CHECK (octet_length(idempotency_digest) = 32),
  CHECK (octet_length(command_digest) = 32),
  CHECK (char_length(target_id) BETWEEN 1 AND 160),
  CHECK (char_length(actor_subject) BETWEEN 1 AND 160),
  CHECK (expected_revision IS NULL OR expected_revision > 0),
  CHECK (accepted_revision IS NULL OR accepted_revision > 0),
  CHECK (current_revision IS NULL OR current_revision > 0),
  CHECK (propagated_revision IS NULL OR propagated_revision > 0),
  CHECK (completed_at IS NULL OR completed_at >= created_at),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS admin_command_receipts_cleanup_idx
  ON admin_command_receipts (expires_at, command_id);

COMMIT;
