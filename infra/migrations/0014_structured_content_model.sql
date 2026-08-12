BEGIN;

CREATE TABLE IF NOT EXISTS admin_shared_content_revisions (
  locale_tag TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  state TEXT NOT NULL CHECK (state IN ('draft', 'ready', 'published', 'archived')),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  actor_subject TEXT NOT NULL CHECK (char_length(actor_subject) BETWEEN 1 AND 160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (locale_tag, revision),
  CHECK (locale_tag ~ '^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS admin_shared_content_heads (
  locale_tag TEXT PRIMARY KEY,
  head_revision BIGINT NOT NULL CHECK (head_revision > 0),
  draft_revision BIGINT,
  published_revision BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (locale_tag, head_revision)
    REFERENCES admin_shared_content_revisions (locale_tag, revision),
  FOREIGN KEY (locale_tag, draft_revision)
    REFERENCES admin_shared_content_revisions (locale_tag, revision),
  FOREIGN KEY (locale_tag, published_revision)
    REFERENCES admin_shared_content_revisions (locale_tag, revision)
);

CREATE INDEX IF NOT EXISTS admin_shared_content_state_idx
  ON admin_shared_content_revisions (locale_tag, state, revision DESC);

COMMIT;
