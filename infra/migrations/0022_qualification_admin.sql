BEGIN;

ALTER TABLE admin_command_receipts
  DROP CONSTRAINT IF EXISTS admin_command_receipts_aggregate_kind_check;
ALTER TABLE admin_command_receipts
  ADD CONSTRAINT admin_command_receipts_aggregate_kind_check
  CHECK (aggregate_kind IN ('route_policy', 'platform_presentation', 'locale', 'page', 'snapshot', 'qualification'));

COMMIT;
