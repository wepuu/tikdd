import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("operational service status migration", () => {
  it("defines the bounded current read model and narrow ops grant", async () => {
    const migration = await readFile(
      new URL("../../../infra/migrations/0021_operational_service_status.sql", import.meta.url),
      "utf8"
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS operational_service_status");
    expect(migration).toContain("PRIMARY KEY (service, deployment)");
    expect(migration).toContain("next_expected_at TIMESTAMPTZ NOT NULL");
    expect(migration).toContain("stale_after_at TIMESTAMPTZ NOT NULL");
    expect(migration).toContain("consecutive_failures SMALLINT");
    expect(migration).toContain("GRANT SELECT, INSERT, UPDATE ON TABLE operational_service_status TO tikdd_ops");
    expect(migration).not.toMatch(/GRANT\s+ALL|SUPERUSER|OWNER\s+TO/i);
  });
});
