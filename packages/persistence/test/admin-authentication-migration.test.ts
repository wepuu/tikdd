import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(fileURLToPath(new URL("../../../infra/migrations/0016_admin_account_authentication.sql", import.meta.url)), "utf8");
const correction = readFileSync(fileURLToPath(new URL("../../../infra/migrations/0017_fix_admin_password_hash_constraint.sql", import.meta.url)), "utf8");

describe("administrator authentication migration", () => {
  it("stores only password hashes and enforces one enabled owner", () => {
    expect(migration).toMatch(/password_hash TEXT NOT NULL/);
    expect(migration).toMatch(/single_enabled_idx/);
    expect(migration).toMatch(/WHERE enabled = TRUE/);
    expect(migration).not.toMatch(/session_token|plain_password|cookie/i);
  });

  it("accepts the exact versioned scrypt hash prefix without regex escaping ambiguity", () => {
    expect(correction).toContain("DROP CONSTRAINT IF EXISTS admin_accounts_password_hash_check");
    expect(correction).toContain("left(password_hash, 10) = 'scrypt$v1$'");
    expect(correction).not.toMatch(/password_hash\s+~/);
  });
});
