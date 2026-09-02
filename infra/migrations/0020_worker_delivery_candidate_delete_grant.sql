BEGIN;

-- TaskRepository.completeWithResolution atomically replaces a task's encrypted
-- delivery candidates before committing its public result and attempt ledger.
-- Production roles are provisioned outside local development, so keep this
-- migration repeatable when the Worker role is absent.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tikdd_worker') THEN
    GRANT DELETE ON TABLE delivery_candidates TO tikdd_worker;
  END IF;
END
$migration$;

COMMIT;
