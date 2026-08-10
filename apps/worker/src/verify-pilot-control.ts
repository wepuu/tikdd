import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabasePool, PilotControlRepository } from "@tikdd/persistence";
import { evaluatePilotGuard, type PilotEvidence, type PilotPolicy } from "@tikdd/rollout-control";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const providerId = `verification-${suffix}`;
const policyId = `verification-policy-${suffix}`;
const pool = createDatabasePool(databaseUrl);
const repository = new PilotControlRepository(pool);
const now = new Date("2026-08-10T12:00:00.000Z");
const policy: PilotPolicy = {
  id: policyId, version: 1, providerId, platform: "x", region: "canary-verification",
  calibrationStartedAt: "2026-08-06T00:00:00.000Z", calibrationCompletedAt: "2026-08-09T00:00:00.000Z",
  lockedAt: "2026-08-09T01:00:00.000Z", expiresAt: "2026-09-09T01:00:00.000Z",
  minimumSamples: 100, maximumEvidenceAgeMs: 3_600_000, staleAction: "reduce", rollbackAllocationBps: 500,
  thresholds: { minimumResolutionSuccessBps: 9500, maximumP95LatencyMs: 8000, maximumChallengeRateBps: 200,
    maximumInvalidResultRateBps: 100, minimumDeliverySuccessBps: 9800 }
};
const evidence: PilotEvidence = {
  providerId, platform: "x", region: "canary-verification", windowStartedAt: "2026-08-10T10:00:00.000Z",
  windowEndedAt: "2026-08-10T11:00:00.000Z", collectedAt: "2026-08-10T11:30:00.000Z", distinctSamples: 120,
  resolutionSuccessBps: 9800, p95LatencyMs: 9000, challengeRateBps: 100, invalidResultRateBps: 25,
  deliverySuccessBps: 9900, absoluteStop: false
};
const summary = { distinctSamples: evidence.distinctSamples, resolutionSuccessBps: evidence.resolutionSuccessBps,
  p95LatencyMs: evidence.p95LatencyMs, challengeRateBps: evidence.challengeRateBps,
  invalidResultRateBps: evidence.invalidResultRateBps, deliverySuccessBps: evidence.deliverySuccessBps };

try {
  await repository.lockPolicy({ policy, reviewerId: "docker-verification" });
  const reduced = evaluatePilotGuard({ policy, evidence, operatorAllocationBps: 2500, currentGuard: null, now });
  assert.deepEqual({ action: reduced.action, reason: reduced.reason, capBps: reduced.capBps }, { action: "reduce", reason: "latency", capBps: 500 });
  await repository.applyGuard({ guard: reduced, expectedRevision: null, actorId: "automatic-verification", sampleSummary: summary });

  const recovered = evaluatePilotGuard({ policy, evidence: { ...evidence, p95LatencyMs: 6000 }, operatorAllocationBps: 10_000,
    currentGuard: reduced, now: new Date("2026-08-10T12:10:00.000Z") });
  assert.equal(recovered.capBps, 500);
  assert.equal(recovered.action, "eligible_for_review");
  await repository.applyGuard({ guard: recovered, expectedRevision: 1, actorId: "automatic-verification", sampleSummary: { ...summary, p95LatencyMs: 6000 } });

  const operatorReviewed = { ...recovered, capBps: 2500, lastHealthyAllocationBps: 2500, action: "hold" as const,
    reason: "healthy_hold" as const, revision: 3, updatedAt: "2026-08-10T12:20:00.000Z", expiresAt: "2026-08-10T13:20:00.000Z" };
  await repository.applyGuard({ guard: operatorReviewed, expectedRevision: 2, actorId: "operator-verification",
    actorType: "operator", operatorGrantAllocationBps: 2500, sampleSummary: { ...summary, p95LatencyMs: 6000 } });
  const snapshot = await repository.loadGuardSnapshot();
  assert.equal(snapshot.guards.find((guard) => guard.providerId === providerId)?.capBps, 2500);
  const audit = await pool.query(`SELECT actor_type,new_cap_bps FROM provider_pilot_guard_audit WHERE provider_id=$1 ORDER BY id`, [providerId]);
  assert.deepEqual(audit.rows, [
    { actor_type: "evaluator", new_cap_bps: 500 },
    { actor_type: "evaluator", new_cap_bps: 500 },
    { actor_type: "operator", new_cap_bps: 2500 }
  ]);
  process.stdout.write("Pilot guard reduction, recovery hold, operator review, and audit verification passed.\n");
} finally {
  await pool.query("DELETE FROM provider_pilot_guard_audit WHERE provider_id=$1", [providerId]);
  await pool.query("DELETE FROM provider_pilot_guards WHERE provider_id=$1", [providerId]);
  await pool.query("DELETE FROM provider_pilot_policies WHERE provider_id=$1", [providerId]);
  await pool.end();
}
