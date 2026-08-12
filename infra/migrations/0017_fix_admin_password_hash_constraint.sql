BEGIN;

ALTER TABLE admin_accounts
  DROP CONSTRAINT IF EXISTS admin_accounts_password_hash_check;

ALTER TABLE admin_accounts
  ADD CONSTRAINT admin_accounts_password_hash_check
  CHECK (left(password_hash, 10) = 'scrypt$v1$');

COMMIT;
