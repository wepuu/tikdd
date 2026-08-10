import { describe, expect, it } from "vitest";
import {
  PilotGuardSnapshotSchema,
  PilotPolicySchema,
  evaluatePilotGuard,
  evaluateRollout,
  type PilotEvidence,
  type RolloutRule
} from "../src/index";

const now = new Date("2026-08-10T12:00:00.000Z");
const policy = PilotPolicySchema.parse({
  id: "x-canary-global-v1", version: 1, providerId: "ssstwitter", platform: "x", region: "canary-global",
  calibrationStartedAt: "2026-08-06T00:00:00.000Z", calibrationCompletedAt: "2026-08-09T00:00:00.000Z",
  lockedAt: "2026-08-09T01:00:00.000Z", expiresAt: "2026-09-09T01:00:00.000Z",
  minimumSamples: 100, maximumEvidenceAgeMs: 3_600_000, staleAction: "reduce", rollbackAllocationBps: 500,
  thresholds: { minimumResolutionSuccessBps: 9500, maximumP95LatencyMs: 8000, maximumChallengeRateBps: 200, maximumInvalidResultRateBps: 100, minimumDeliverySuccessBps: 9800 }
});
const evidence: PilotEvidence = {
  providerId: "ssstwitter", platform: "x", region: "canary-global",
  windowStartedAt: "2026-08-10T10:00:00.000Z", windowEndedAt: "2026-08-10T11:00:00.000Z",
  collectedAt: "2026-08-10T11:30:00.000Z", distinctSamples: 120,
  resolutionSuccessBps: 9800, p95LatencyMs: 6000, challengeRateBps: 100,
  invalidResultRateBps: 25, deliverySuccessBps: 9900, absoluteStop: false
};

describe("pilot automatic guard", () => {
  it("refuses invented policies without three complete calibration days", () => {
    expect(() => PilotPolicySchema.parse({ ...policy, calibrationCompletedAt: "2026-08-08T23:59:59.999Z" })).toThrow(/three complete calibration days/);
  });

  it("never raises an existing cap on healthy evidence", () => {
    const reduced = evaluatePilotGuard({ policy, evidence: { ...evidence, p95LatencyMs: 9000 }, operatorAllocationBps: 2500, currentGuard: null, now });
    expect(reduced).toMatchObject({ action: "reduce", reason: "latency", capBps: 500 });
    const recovered = evaluatePilotGuard({ policy, evidence, operatorAllocationBps: 10_000, currentGuard: reduced, now: new Date("2026-08-10T12:10:00.000Z") });
    expect(recovered).toMatchObject({ action: "eligible_for_review", capBps: 500, lastHealthyAllocationBps: 500 });
  });

  it("holds insufficient samples and reduces stale evidence", () => {
    expect(evaluatePilotGuard({ policy, evidence: { ...evidence, distinctSamples: 99 }, operatorAllocationBps: 2500, currentGuard: null, now })).toMatchObject({ action: "hold", reason: "insufficient_samples", capBps: 2500 });
    expect(evaluatePilotGuard({ policy, evidence, operatorAllocationBps: 2500, currentGuard: null, now: new Date("2026-08-10T13:00:00.001Z") })).toMatchObject({ action: "reduce", reason: "stale_evidence", capBps: 500 });
  });

  it("denies absolute stops and applies a guard after operator denies and grants", () => {
    const guard = evaluatePilotGuard({ policy, evidence: { ...evidence, absoluteStop: true }, operatorAllocationBps: 2500, currentGuard: null, now });
    expect(guard).toMatchObject({ action: "deny", capBps: 0 });
    const grant: RolloutRule = { id: "ssstwitter-x-canary", providerId: "ssstwitter", platform: "x", region: "canary-global", enabled: true, allocationBps: 10_000, revision: 1, activatesAt: "2026-08-10T00:00:00.000Z", expiresAt: null };
    const snapshot = { schemaVersion: "1" as const, revision: 1, generatedAt: now.toISOString(), rules: [grant] };
    const guardSnapshot = PilotGuardSnapshotSchema.parse({ schemaVersion: "1", revision: 1, generatedAt: now.toISOString(), guards: [guard] });
    expect(evaluateRollout({ snapshot, request: { taskId: "tsk_0123456789abcdef0123456789abcdef", providerId: "ssstwitter", providerKind: "site-adapter", platform: "x", region: "canary-global" }, cohortKey: Buffer.alloc(32, 1), now, guardSnapshot, guardRequired: true })).toMatchObject({ allowed: false, reason: "automatic_guard_denied" });
    expect(evaluateRollout({ snapshot: { ...snapshot, rules: [{ ...grant, enabled: false, allocationBps: 0 }] }, request: { taskId: "tsk_0123456789abcdef0123456789abcdef", providerId: "ssstwitter", providerKind: "site-adapter", platform: "x", region: "canary-global" }, cohortKey: Buffer.alloc(32, 1), now, guardSnapshot, guardRequired: true })).toMatchObject({ allowed: false, reason: "matching_deny" });
  });

  it("fails closed when a required guard is absent or stale", () => {
    const grant: RolloutRule = { id: "ssstwitter-x-canary", providerId: "ssstwitter", platform: "x", region: "canary-global", enabled: true, allocationBps: 10_000, revision: 1, activatesAt: "2026-08-10T00:00:00.000Z", expiresAt: null };
    const base = { snapshot: { schemaVersion: "1" as const, revision: 1, generatedAt: now.toISOString(), rules: [grant] }, request: { taskId: "tsk_0123456789abcdef0123456789abcdef", providerId: "ssstwitter", providerKind: "site-adapter" as const, platform: "x", region: "canary-global" }, cohortKey: Buffer.alloc(32, 1), now, guardRequired: true };
    expect(evaluateRollout(base)).toMatchObject({ allowed: false, reason: "guard_unavailable" });
    expect(evaluateRollout({ ...base, guardSnapshot: { schemaVersion: "1", revision: 1, generatedAt: "2026-08-10T10:00:00.000Z", guards: [] }, maximumGuardStaleMs: 60_000 })).toMatchObject({ allowed: false, reason: "stale_guard" });
  });
});
