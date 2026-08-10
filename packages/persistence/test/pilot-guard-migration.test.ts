import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("provider pilot guard migration", () => {
  it("keeps policies, current restrictive state, reviews, and audit durable", () => {
    const migration = readFileSync(new URL("../../../infra/migrations/0009_provider_pilot_guards.sql", import.meta.url), "utf8");
    expect(migration).toContain("calibration_completed_at >= calibration_started_at + INTERVAL '3 days'");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS provider_pilot_guards");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS provider_pilot_guard_audit");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS provider_qualification_reviews");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS provider_qualification_review_audit");
    expect(migration).not.toMatch(/submitted_url|canonical_url|candidate_id|task_id|cookie|header/);
  });
});
