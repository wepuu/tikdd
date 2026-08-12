BEGIN;

ALTER TABLE admin_published_snapshots
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS actor_subject TEXT,
  ADD COLUMN IF NOT EXISTS affected_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS revalidation_attempts INTEGER NOT NULL DEFAULT 0;

UPDATE admin_published_snapshots
SET reason = COALESCE(reason, 'Legacy published snapshot.'),
    actor_subject = COALESCE(actor_subject, 'system_seed')
WHERE reason IS NULL OR actor_subject IS NULL;

ALTER TABLE admin_published_snapshots
  ALTER COLUMN reason SET NOT NULL,
  ALTER COLUMN actor_subject SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE admin_published_snapshots ADD CONSTRAINT admin_snapshot_affected_paths
    CHECK (jsonb_typeof(affected_paths) = 'array' AND jsonb_array_length(affected_paths) <= 10000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE admin_published_snapshots ADD CONSTRAINT admin_snapshot_revalidation_attempts
    CHECK (revalidation_attempts BETWEEN 0 AND 10);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE admin_published_snapshots ADD CONSTRAINT admin_snapshot_reason_length
    CHECK (char_length(reason) BETWEEN 1 AND 500);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE admin_published_snapshots ADD CONSTRAINT admin_snapshot_actor_length
    CHECK (char_length(actor_subject) BETWEEN 1 AND 160);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS admin_published_snapshots_propagation_idx
  ON admin_published_snapshots (deployment, propagation_state, revision DESC);

COMMIT;
