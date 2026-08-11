import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pilot evidence migration", () => {
  it("creates sanitized source, aggregate, review, evaluator, and cleanup boundaries", () => {
    const migration = readFileSync(new URL("../../../infra/migrations/0010_pilot_evidence.sql", import.meta.url), "utf8");
    for (const table of ["provider_delivery_outcomes", "provider_daily_evidence", "provider_late_evidence_counts", "provider_calibration_proposals", "provider_evidence_reviews", "provider_evidence_export_audit", "provider_evidence_evaluator_runs"]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(migration).toContain("observation_class IN ('canary', 'internal', 'public')");
    expect(migration).toContain("provider_delivery_outcomes_cleanup_idx");
    expect(migration).not.toMatch(/submitted_url|canonical_url.*provider_delivery_outcomes|candidate_id UUID|format_id.*provider_delivery_outcomes|caller_id|cookie|header|payload/);
  });
});
