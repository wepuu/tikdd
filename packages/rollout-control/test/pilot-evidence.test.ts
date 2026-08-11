import { describe, expect, it } from "vitest";
import { aggregatePilotEvidenceDay, buildPilotEvidence, DeliveryOutcomeSchema } from "../src/evidence";

const base = {
  providerId: "ssstwitter", platform: "x" as const, region: "global", observationClass: "public" as const,
  status: "failed" as const, failureCode: "provider_timeout" as const,
  startedAt: "2026-08-10T01:00:00.000Z", finishedAt: "2026-08-10T01:00:02.000Z", durationMs: 2000,
  fallbackDepth: 1, resultFormatCount: 0, candidateCount: 0, absoluteStop: false
};

describe("pilot evidence aggregation", () => {
  it("collapses queue retries to one exact-tuple task sample", () => {
    const [day] = aggregatePilotEvidenceDay({ utcDay: "2026-08-10", now: new Date("2026-08-13T00:00:00Z"), resolutions: [
      { ...base, taskId: "task-a" },
      { ...base, taskId: "task-a", status: "succeeded", failureCode: null, finishedAt: "2026-08-10T01:00:03.000Z", durationMs: 3000, resultFormatCount: 2, candidateCount: 2 }
    ], deliveries: [] });
    expect(day).toMatchObject({ completeness: "sealed", distinctResolutionTasks: 1, resolutionSuccessCount: 1, resultFormatCount: 2, candidateCount: 2 });
    expect(JSON.stringify(day)).not.toContain("task-a");
  });

  it("keeps delivery stages sanitized and computes a versioned window", () => {
    const delivery = DeliveryOutcomeSchema.parse({ outcomeId: "5edc44eb-8849-4bc3-8608-2b35dfaf346d", providerId: "ssstwitter", platform: "x", region: "global", observationClass: "public", mode: "redirect", stage: "redirect_validation", result: "passed", durationMs: 30, occurredAt: "2026-08-10T02:00:00.000Z", ingestedAt: "2026-08-10T02:00:00.100Z", expiresAt: "2026-09-14T02:00:00.000Z", deliveryPolicyVersion: 1, taxonomyVersion: 1 });
    const [day] = aggregatePilotEvidenceDay({ utcDay: "2026-08-10", now: new Date("2026-08-11T01:00:00Z"), resolutions: [{ ...base, taskId: "task-b", status: "succeeded", failureCode: null, resultFormatCount: 2, candidateCount: 2 }], deliveries: [delivery] });
    const evidence = buildPilotEvidence([day!], new Date("2026-08-11T01:05:00Z"));
    expect(evidence).toMatchObject({ distinctSamples: 1, deliverySuccessBps: 10_000, candidateCoverageBps: 10_000, completeDays: 1 });
  });

  it("rejects forbidden or inconsistent delivery data", () => {
    expect(() => DeliveryOutcomeSchema.parse({ outcomeId: "5edc44eb-8849-4bc3-8608-2b35dfaf346d", providerId: "ssstwitter", platform: "x", region: "global", observationClass: "public", mode: "redirect", stage: "browser_handoff", result: "ticket_expired", durationMs: 1, occurredAt: "2026-08-10T02:00:00.000Z", ingestedAt: "2026-08-10T02:00:00.100Z", expiresAt: "2026-09-14T02:00:00.000Z", deliveryPolicyVersion: 1, taxonomyVersion: 1, taskId: "forbidden" })).toThrow();
  });
});
