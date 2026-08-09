import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("provider rollout persistence migration", () => {
  it("creates durable rules, selector uniqueness, and append-only audit metadata", async () => {
    const migration = await readFile(
      new URL("../../../infra/migrations/0005_provider_rollout_rules.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS provider_rollout_rules");
    expect(migration).toContain("provider_rollout_rules_selector_idx");
    expect(migration).toContain("provider_id <> '*' OR NOT enabled");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS provider_rollout_rule_audit");
    expect(migration).toContain("before_rule JSONB");
    expect(migration).toContain("after_rule JSONB NOT NULL");
  });
});
