BEGIN;

-- TaskAdmissionRepository removes only expired, digest-only admission rows before
-- inserting a replacement. Production API roles are provisioned outside local
-- development, so keep the migration repeatable when that role is absent.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tikdd_api') THEN
    GRANT DELETE ON TABLE resolve_task_idempotency TO tikdd_api;
    GRANT DELETE ON TABLE active_source_admissions TO tikdd_api;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tikdd_worker') THEN
    -- Terminal task transitions release only the task-bound active-source row.
    GRANT DELETE ON TABLE active_source_admissions TO tikdd_worker;
  END IF;
END
$migration$;

COMMIT;
