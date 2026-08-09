BEGIN;

CREATE INDEX IF NOT EXISTS resolve_tasks_cleanup_expiry_idx
  ON resolve_tasks (expires_at, id);
CREATE INDEX IF NOT EXISTS resolve_tasks_cleanup_status_expiry_idx
  ON resolve_tasks (expires_at, id)
  WHERE status <> 'expired';
CREATE INDEX IF NOT EXISTS delivery_candidates_cleanup_expiry_idx
  ON delivery_candidates (expires_at, id);
CREATE INDEX IF NOT EXISTS delivery_tickets_cleanup_expiry_idx
  ON delivery_tickets (expires_at, id);
CREATE INDEX IF NOT EXISTS resolve_task_idempotency_cleanup_expiry_idx
  ON resolve_task_idempotency (expires_at, key_digest);
CREATE INDEX IF NOT EXISTS active_source_admissions_cleanup_expiry_idx
  ON active_source_admissions (expires_at, source_fingerprint);

COMMIT;
