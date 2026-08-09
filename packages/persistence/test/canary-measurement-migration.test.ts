import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("canary measurement migration", () => {
  it("stores only bounded operational measurements with expiry", async () => {
    const migration = await readFile(new URL("../../../infra/migrations/0008_canary_measurements.sql", import.meta.url), "utf8");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS provider_canary_measurements");
    expect(migration).toContain("failure_code TEXT");
    expect(migration).toContain("link_lifetime_ms BIGINT");
    expect(migration).toContain("expires_at TIMESTAMPTZ NOT NULL");
    expect(migration).not.toMatch(/source_url|canonical_url|target_url|title|thumbnail|payload|response_body/i);
  });
});
