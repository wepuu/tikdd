BEGIN;

ALTER TABLE resolve_tasks
  ADD COLUMN IF NOT EXISTS observation_class TEXT NOT NULL DEFAULT 'public';
ALTER TABLE resolve_tasks DROP CONSTRAINT IF EXISTS resolve_tasks_observation_class_check;
ALTER TABLE resolve_tasks ADD CONSTRAINT resolve_tasks_observation_class_check
  CHECK (observation_class IN ('internal', 'public'));

ALTER TABLE delivery_candidates ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE delivery_candidates ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE delivery_candidates ADD COLUMN IF NOT EXISTS observation_class TEXT;
UPDATE delivery_candidates dc
SET platform = rt.platform,
    observation_class = rt.observation_class,
    region = COALESCE((
      SELECT pa.region FROM provider_attempts pa
      WHERE pa.task_id = dc.task_id AND pa.provider_id = dc.provider_id
      ORDER BY (pa.status = 'succeeded') DESC, pa.finished_at DESC, pa.id DESC
      LIMIT 1
    ), 'global')
FROM resolve_tasks rt
WHERE rt.id = dc.task_id
  AND (dc.platform IS NULL OR dc.region IS NULL OR dc.observation_class IS NULL);
ALTER TABLE delivery_candidates ALTER COLUMN platform SET NOT NULL;
ALTER TABLE delivery_candidates ALTER COLUMN region SET NOT NULL;
ALTER TABLE delivery_candidates ALTER COLUMN observation_class SET NOT NULL;
ALTER TABLE delivery_candidates DROP CONSTRAINT IF EXISTS delivery_candidates_platform_check;
ALTER TABLE delivery_candidates ADD CONSTRAINT delivery_candidates_platform_check
  CHECK (platform ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE delivery_candidates DROP CONSTRAINT IF EXISTS delivery_candidates_region_check;
ALTER TABLE delivery_candidates ADD CONSTRAINT delivery_candidates_region_check
  CHECK (region ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE delivery_candidates DROP CONSTRAINT IF EXISTS delivery_candidates_observation_class_check;
ALTER TABLE delivery_candidates ADD CONSTRAINT delivery_candidates_observation_class_check
  CHECK (observation_class IN ('internal', 'public'));

ALTER TABLE delivery_tickets
  ADD COLUMN IF NOT EXISTS ticket_creation_outcome_emitted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE delivery_tickets
  ADD COLUMN IF NOT EXISTS redirect_validation_outcome_emitted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE delivery_tickets
  ADD COLUMN IF NOT EXISTS browser_handoff_outcome_emitted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE delivery_tickets
  ADD COLUMN IF NOT EXISTS expiry_outcome_emitted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE provider_pilot_guard_audit
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '400 days');
ALTER TABLE provider_qualification_review_audit
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '400 days');
CREATE INDEX IF NOT EXISTS provider_pilot_guard_audit_cleanup_idx
  ON provider_pilot_guard_audit (expires_at, id);
CREATE INDEX IF NOT EXISTS provider_qualification_review_audit_cleanup_idx
  ON provider_qualification_review_audit (expires_at, id);
ALTER TABLE provider_pilot_guards DROP CONSTRAINT IF EXISTS provider_pilot_guards_reason_code_check;
ALTER TABLE provider_pilot_guards ADD CONSTRAINT provider_pilot_guards_reason_code_check CHECK (reason_code IN (
  'healthy_hold','insufficient_samples','stale_evidence','absolute_stop','resolution_error','latency',
  'challenge','invalid_result','delivery_error','candidate_coverage','fallback_depth','timeout','expiry',
  'incompatible_evidence'
));

CREATE TABLE IF NOT EXISTS provider_delivery_outcomes (
  outcome_id UUID PRIMARY KEY,
  provider_id TEXT NOT NULL CHECK (provider_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  platform TEXT NOT NULL CHECK (platform ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  region TEXT NOT NULL CHECK (region ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  observation_class TEXT NOT NULL CHECK (observation_class IN ('canary', 'internal', 'public')),
  mode TEXT NOT NULL CHECK (mode IN ('redirect', 'proxy', 'temporary-object')),
  stage TEXT NOT NULL CHECK (stage IN ('ticket_creation', 'redirect_validation', 'ticket_expiry', 'browser_handoff')),
  result_class TEXT NOT NULL CHECK (result_class IN (
    'succeeded', 'candidate_missing', 'candidate_expired', 'task_unavailable', 'rejected',
    'internal_error', 'passed', 'ticket_invalid', 'ticket_expired', 'host_rejected',
    'dns_rejected', 'mode_rejected', 'expired_unredeemed', 'redirect_issued'
  )),
  duration_ms INTEGER NOT NULL CHECK (duration_ms BETWEEN 0 AND 120000),
  delivery_policy_version INTEGER NOT NULL CHECK (delivery_policy_version > 0),
  taxonomy_version INTEGER NOT NULL CHECK (taxonomy_version > 0),
  occurred_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > occurred_at)
);
CREATE INDEX IF NOT EXISTS provider_delivery_outcomes_tuple_time_idx
  ON provider_delivery_outcomes (provider_id, platform, region, observation_class, occurred_at);
CREATE INDEX IF NOT EXISTS provider_delivery_outcomes_cleanup_idx
  ON provider_delivery_outcomes (expires_at, outcome_id);

CREATE TABLE IF NOT EXISTS provider_daily_evidence (
  provider_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  observation_class TEXT NOT NULL CHECK (observation_class IN ('canary', 'internal', 'public')),
  utc_day DATE NOT NULL,
  aggregation_version INTEGER NOT NULL CHECK (aggregation_version > 0),
  taxonomy_version INTEGER NOT NULL CHECK (taxonomy_version > 0),
  completeness TEXT NOT NULL CHECK (completeness IN ('open', 'complete', 'sealed')),
  source_watermark TIMESTAMPTZ NOT NULL,
  aggregate_revision BIGINT NOT NULL CHECK (aggregate_revision > 0),
  summary JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (provider_id, platform, region, observation_class, utc_day, aggregation_version, taxonomy_version),
  CHECK (expires_at > generated_at)
);
CREATE INDEX IF NOT EXISTS provider_daily_evidence_window_idx
  ON provider_daily_evidence (provider_id, platform, region, observation_class, utc_day DESC);
CREATE INDEX IF NOT EXISTS provider_daily_evidence_cleanup_idx
  ON provider_daily_evidence (expires_at, provider_id, platform, region, observation_class, utc_day);

CREATE TABLE IF NOT EXISTS provider_late_evidence_counts (
  provider_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  observation_class TEXT NOT NULL CHECK (observation_class IN ('canary','internal','public')),
  source_utc_day DATE NOT NULL,
  detected_utc_day DATE NOT NULL,
  aggregation_version INTEGER NOT NULL CHECK (aggregation_version>0),
  taxonomy_version INTEGER NOT NULL CHECK (taxonomy_version>0),
  late_count INTEGER NOT NULL CHECK (late_count>0),
  source_watermark TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(provider_id,platform,region,observation_class,source_utc_day,aggregation_version,taxonomy_version)
);
CREATE INDEX IF NOT EXISTS provider_late_evidence_counts_cleanup_idx
  ON provider_late_evidence_counts(expires_at,provider_id,platform,region,source_utc_day);

CREATE TABLE IF NOT EXISTS provider_calibration_proposals (
  proposal_id UUID PRIMARY KEY,
  provider_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  observation_class TEXT NOT NULL CHECK (observation_class = 'internal'),
  aggregation_version INTEGER NOT NULL CHECK (aggregation_version > 0),
  taxonomy_version INTEGER NOT NULL CHECK (taxonomy_version > 0),
  day_revisions JSONB NOT NULL,
  proposed_policy JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'locked', 'rejected', 'superseded')),
  evidence_owner_id TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS provider_calibration_proposals_tuple_idx
  ON provider_calibration_proposals (provider_id, platform, region, created_at DESC);
CREATE INDEX IF NOT EXISTS provider_calibration_proposals_cleanup_idx
  ON provider_calibration_proposals (expires_at, proposal_id);

CREATE TABLE IF NOT EXISTS provider_evidence_reviews (
  review_id UUID PRIMARY KEY,
  proposal_id UUID REFERENCES provider_calibration_proposals(proposal_id) ON DELETE SET NULL,
  provider_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('lock_policy', 'reject_proposal', 'recovery_review', 'deny_recovery')),
  policy_id TEXT,
  policy_version INTEGER,
  evidence_window_started_at TIMESTAMPTZ NOT NULL,
  evidence_window_ended_at TIMESTAMPTZ NOT NULL,
  day_revisions JSONB NOT NULL,
  reviewer_id TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (evidence_window_ended_at > evidence_window_started_at)
);
CREATE INDEX IF NOT EXISTS provider_evidence_reviews_cleanup_idx
  ON provider_evidence_reviews (expires_at, review_id);

CREATE TABLE IF NOT EXISTS provider_evidence_export_audit (
  id BIGSERIAL PRIMARY KEY,
  provider_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  observation_class TEXT NOT NULL CHECK (observation_class IN ('canary', 'internal', 'public')),
  window_started_on DATE NOT NULL,
  window_ended_on DATE NOT NULL,
  day_count SMALLINT NOT NULL CHECK (day_count BETWEEN 1 AND 31),
  actor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (window_ended_on >= window_started_on)
);

CREATE TABLE IF NOT EXISTS provider_evidence_evaluator_runs (
  id BIGSERIAL PRIMARY KEY,
  deployment TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'failed', 'lease_unavailable')),
  tuple_count INTEGER NOT NULL CHECK (tuple_count >= 0),
  changed_guard_count INTEGER NOT NULL CHECK (changed_guard_count >= 0),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  error_code TEXT,
  CHECK (finished_at >= started_at)
);
CREATE INDEX IF NOT EXISTS provider_evidence_evaluator_runs_time_idx
  ON provider_evidence_evaluator_runs (finished_at DESC, id DESC);

COMMIT;
