-- Work item 10.5: calibrated pilot policy, restrictive guard, qualification review, and append-only audit.
CREATE TABLE IF NOT EXISTS provider_pilot_policies (
  policy_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  provider_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region <> '*'),
  policy JSONB NOT NULL,
  calibration_started_at TIMESTAMPTZ NOT NULL,
  calibration_completed_at TIMESTAMPTZ NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  reviewer_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (policy_id, version),
  CHECK (calibration_completed_at >= calibration_started_at + INTERVAL '3 days'),
  CHECK (locked_at >= calibration_completed_at),
  CHECK (expires_at > locked_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_pilot_policies_active_tuple_idx
  ON provider_pilot_policies (provider_id, platform, region, version);

CREATE TABLE IF NOT EXISTS provider_pilot_guards (
  provider_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region <> '*'),
  policy_id TEXT NOT NULL,
  policy_version INTEGER NOT NULL,
  cap_bps INTEGER NOT NULL CHECK (cap_bps BETWEEN 0 AND 10000),
  last_healthy_allocation_bps INTEGER NOT NULL CHECK (last_healthy_allocation_bps BETWEEN 0 AND 10000),
  action TEXT NOT NULL CHECK (action IN ('hold', 'reduce', 'deny', 'eligible_for_review')),
  reason_code TEXT NOT NULL CHECK (reason_code IN ('healthy_hold', 'insufficient_samples', 'stale_evidence', 'absolute_stop', 'resolution_error', 'latency', 'challenge', 'invalid_result', 'delivery_error')),
  evidence_window_started_at TIMESTAMPTZ NOT NULL,
  evidence_window_ended_at TIMESTAMPTZ NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  updated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (provider_id, platform, region),
  FOREIGN KEY (policy_id, policy_version) REFERENCES provider_pilot_policies(policy_id, version),
  CHECK (evidence_window_ended_at > evidence_window_started_at),
  CHECK (expires_at > updated_at)
);

CREATE TABLE IF NOT EXISTS provider_pilot_guard_audit (
  id BIGSERIAL PRIMARY KEY,
  provider_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  policy_version INTEGER NOT NULL,
  previous_cap_bps INTEGER,
  new_cap_bps INTEGER NOT NULL CHECK (new_cap_bps BETWEEN 0 AND 10000),
  action TEXT NOT NULL CHECK (action IN ('hold', 'reduce', 'deny', 'eligible_for_review')),
  reason_code TEXT NOT NULL,
  evidence_window_started_at TIMESTAMPTZ NOT NULL,
  evidence_window_ended_at TIMESTAMPTZ NOT NULL,
  sample_summary JSONB NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('evaluator', 'operator')),
  actor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS provider_pilot_guard_audit_tuple_idx
  ON provider_pilot_guard_audit (provider_id, platform, region, id DESC);

CREATE TABLE IF NOT EXISTS provider_qualification_reviews (
  provider_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('candidate', 'fixture-ready', 'canary-ready', 'internal', 'limited', 'stable')),
  paused BOOLEAN NOT NULL DEFAULT TRUE,
  pause_reason TEXT,
  approval_reference TEXT,
  policy_id TEXT,
  policy_version INTEGER,
  reviewer_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision > 0),
  reviewed_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider_id, platform, region)
);

CREATE TABLE IF NOT EXISTS provider_qualification_review_audit (
  id BIGSERIAL PRIMARY KEY,
  provider_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  region TEXT NOT NULL,
  previous_stage TEXT,
  new_stage TEXT NOT NULL,
  previous_allocation_bps INTEGER,
  requested_allocation_bps INTEGER NOT NULL CHECK (requested_allocation_bps BETWEEN 0 AND 10000),
  approval_reference TEXT,
  policy_id TEXT,
  policy_version INTEGER,
  evidence_window_started_at TIMESTAMPTZ NOT NULL,
  evidence_window_ended_at TIMESTAMPTZ NOT NULL,
  sample_sufficient BOOLEAN NOT NULL,
  actor_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (evidence_window_ended_at > evidence_window_started_at)
);
CREATE INDEX IF NOT EXISTS provider_qualification_review_audit_tuple_idx
  ON provider_qualification_review_audit (provider_id, platform, region, id DESC);
