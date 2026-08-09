BEGIN;

ALTER TABLE provider_attempts ADD COLUMN IF NOT EXISTS region TEXT;

UPDATE provider_attempts
SET region = 'global'
WHERE region IS NULL;

ALTER TABLE provider_attempts ALTER COLUMN region SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'provider_attempts_region_check'
      AND conrelid = 'provider_attempts'::regclass
  ) THEN
    ALTER TABLE provider_attempts ADD CONSTRAINT provider_attempts_region_check
      CHECK (region ~ '^[a-z0-9]+(-[a-z0-9]+)*$') NOT VALID;
  END IF;
END
$$;

ALTER TABLE provider_attempts VALIDATE CONSTRAINT provider_attempts_region_check;

CREATE INDEX IF NOT EXISTS provider_attempts_circuit_health_idx
  ON provider_attempts (provider_id, platform, region, created_at DESC);

COMMIT;
