import { createHmac } from "node:crypto";
import {
  ProviderRolloutRequestSchema,
  RolloutDecisionSchema,
  PilotGuardSnapshotSchema,
  RolloutSnapshotSchema,
  type ProviderRolloutRequest,
  type RolloutDecision,
  type RolloutRule,
  type RolloutSnapshot
} from "./model";

function isActive(rule: RolloutRule, now: Date): boolean {
  const timestamp = now.getTime();
  return (
    new Date(rule.activatesAt).getTime() <= timestamp &&
    (rule.expiresAt === null || new Date(rule.expiresAt).getTime() > timestamp)
  );
}

function matches(rule: RolloutRule, request: ProviderRolloutRequest): boolean {
  return (
    (rule.providerId === "*" || rule.providerId === request.providerId) &&
    (rule.platform === "*" || rule.platform === request.platform) &&
    (rule.region === "*" || rule.region === request.region)
  );
}

function specificity(rule: RolloutRule): number {
  return Number(rule.providerId !== "*") + Number(rule.platform !== "*") + Number(rule.region !== "*");
}

export function rolloutBucket(
  ruleId: string,
  taskId: string,
  cohortKey: Uint8Array
): number {
  if (cohortKey.byteLength < 32) {
    throw new Error("The rollout cohort key must contain at least 32 bytes.");
  }
  const digest = createHmac("sha256", cohortKey)
    .update(`tikdd-rollout-v1\0${ruleId.length}:${ruleId}${taskId.length}:${taskId}`)
    .digest();
  return digest.readUInt32BE(0) % 10_000;
}

export function evaluateRollout(input: {
  snapshot: RolloutSnapshot;
  request: ProviderRolloutRequest;
  cohortKey: Uint8Array;
  now?: Date;
  guardSnapshot?: unknown;
  guardRequired?: boolean;
  maximumGuardStaleMs?: number;
}): RolloutDecision {
  const snapshot = RolloutSnapshotSchema.parse(input.snapshot);
  const request = ProviderRolloutRequestSchema.parse(input.request);
  const now = input.now ?? new Date();

  if (request.providerKind === "mock") {
    return RolloutDecisionSchema.parse({
      allowed: false,
      reason: "production_mock_denied",
      ruleId: null,
      snapshotRevision: snapshot.revision,
      bucket: null
    });
  }

  const applicable = snapshot.rules.filter((rule) => isActive(rule, now) && matches(rule, request));
  const deny = applicable
    .filter((rule) => !rule.enabled)
    .sort((left, right) => specificity(right) - specificity(left) || left.id.localeCompare(right.id))[0];
  if (deny) {
    return RolloutDecisionSchema.parse({
      allowed: false,
      reason: "matching_deny",
      ruleId: deny.id,
      snapshotRevision: snapshot.revision,
      bucket: null
    });
  }

  const grant = applicable
    .filter((rule) => rule.enabled)
    .sort((left, right) => specificity(right) - specificity(left) || left.id.localeCompare(right.id))[0];
  if (!grant) {
    return RolloutDecisionSchema.parse({
      allowed: false,
      reason: "no_matching_rule",
      ruleId: null,
      snapshotRevision: snapshot.revision,
      bucket: null
    });
  }

  const bucket = rolloutBucket(grant.id, request.taskId, input.cohortKey);
  if (bucket >= grant.allocationBps) {
    return RolloutDecisionSchema.parse({ allowed: false, reason: "outside_allocation", ruleId: grant.id, snapshotRevision: snapshot.revision, bucket });
  }
  if (input.guardRequired || input.guardSnapshot) {
    if (!input.guardSnapshot) return RolloutDecisionSchema.parse({ allowed: false, reason: "guard_unavailable", ruleId: grant.id, snapshotRevision: snapshot.revision, bucket });
    const guards = PilotGuardSnapshotSchema.parse(input.guardSnapshot);
    const maximumStaleMs = input.maximumGuardStaleMs ?? 60_000;
    const ageMs = now.getTime() - new Date(guards.generatedAt).getTime();
    if (ageMs < -5_000 || ageMs > maximumStaleMs) return RolloutDecisionSchema.parse({ allowed: false, reason: "stale_guard", ruleId: grant.id, snapshotRevision: snapshot.revision, bucket });
    const guard = guards.guards.find((candidate) => candidate.providerId === request.providerId && candidate.platform === request.platform && candidate.region === request.region);
    if (!guard || new Date(guard.expiresAt) <= now) return RolloutDecisionSchema.parse({ allowed: false, reason: "guard_unavailable", ruleId: grant.id, snapshotRevision: snapshot.revision, bucket });
    if (guard.capBps === 0) return RolloutDecisionSchema.parse({ allowed: false, reason: "automatic_guard_denied", ruleId: grant.id, snapshotRevision: snapshot.revision, bucket });
    if (bucket >= Math.min(grant.allocationBps, guard.capBps)) return RolloutDecisionSchema.parse({ allowed: false, reason: "outside_guard_allocation", ruleId: grant.id, snapshotRevision: snapshot.revision, bucket });
  }
  return RolloutDecisionSchema.parse({
    allowed: true,
    reason: "allowed",
    ruleId: grant.id,
    snapshotRevision: snapshot.revision,
    bucket
  });
}
