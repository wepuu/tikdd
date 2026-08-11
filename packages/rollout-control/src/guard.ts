import {
  PilotEvidenceSchema,
  PilotGuardSchema,
  PilotPolicySchema,
  type PilotEvidence,
  type PilotGuard,
  type PilotGuardReason,
  type PilotPolicy
} from "./model";

function sameTuple(policy: PilotPolicy, evidence: PilotEvidence): boolean {
  return policy.providerId === evidence.providerId && policy.platform === evidence.platform &&
    policy.region === evidence.region && policy.observationClass === evidence.observationClass;
}

export function evaluatePilotGuard(input: {
  policy: PilotPolicy;
  evidence: PilotEvidence;
  operatorAllocationBps: number;
  currentGuard: PilotGuard | null;
  now?: Date;
}): PilotGuard {
  const policy = PilotPolicySchema.parse(input.policy);
  const evidence = PilotEvidenceSchema.parse(input.evidence);
  const now = input.now ?? new Date();
  if (!sameTuple(policy, evidence)) throw new Error("Pilot policy and evidence tuple do not match.");
  if (!Number.isInteger(input.operatorAllocationBps) || input.operatorAllocationBps < 0 || input.operatorAllocationBps > 10_000) {
    throw new Error("Operator allocation must be expressed in basis points.");
  }
  if (now < new Date(policy.lockedAt) || now >= new Date(policy.expiresAt)) throw new Error("Pilot policy is not active.");

  const current = input.currentGuard ? PilotGuardSchema.parse(input.currentGuard) : null;
  if (current && (current.providerId !== policy.providerId || current.platform !== policy.platform || current.region !== policy.region)) {
    throw new Error("Current pilot guard tuple does not match the policy.");
  }
  const currentCap = Math.min(input.operatorAllocationBps, current?.capBps ?? input.operatorAllocationBps);
  const evidenceAgeMs = now.getTime() - new Date(evidence.collectedAt).getTime();
  const stale = evidenceAgeMs < 0 || evidenceAgeMs > policy.maximumEvidenceAgeMs;
  const insufficient = evidence.distinctSamples < policy.minimumSamples;
  const incompatible = evidence.aggregationVersion !== policy.aggregationVersion ||
    evidence.taxonomyVersion !== policy.taxonomyVersion || evidence.completeDays !== policy.evaluationDays;
  let reason: PilotGuardReason = "healthy_hold";
  let action: PilotGuard["action"] = "eligible_for_review";
  let capBps = currentCap;

  if (evidence.absoluteStop) {
    reason = "absolute_stop"; action = "deny"; capBps = 0;
  } else if (incompatible) {
    reason = "incompatible_evidence";
    capBps = Math.min(currentCap, current?.lastHealthyAllocationBps ?? policy.rollbackAllocationBps);
    action = capBps === 0 ? "deny" : "reduce";
  } else if (stale) {
    reason = "stale_evidence";
    capBps = policy.staleAction === "deny" ? 0 : Math.min(currentCap, current?.lastHealthyAllocationBps ?? policy.rollbackAllocationBps);
    action = capBps === 0 ? "deny" : "reduce";
  } else if (insufficient) {
    reason = "insufficient_samples";
    if (input.operatorAllocationBps > 0) {
      capBps = policy.staleAction === "deny" ? 0 : Math.min(currentCap, current?.lastHealthyAllocationBps ?? policy.rollbackAllocationBps);
      action = capBps === 0 ? "deny" : "reduce";
    } else {
      action = "hold";
    }
  } else {
    const breach: PilotGuardReason | null =
      evidence.resolutionSuccessBps < policy.thresholds.minimumResolutionSuccessBps ? "resolution_error" :
      evidence.p95LatencyMs > policy.thresholds.maximumP95LatencyMs ? "latency" :
      evidence.challengeRateBps > policy.thresholds.maximumChallengeRateBps ? "challenge" :
      evidence.timeoutRateBps > policy.thresholds.maximumTimeoutRateBps ? "timeout" :
      evidence.invalidResultRateBps > policy.thresholds.maximumInvalidResultRateBps ? "invalid_result" :
      evidence.deliverySuccessBps < policy.thresholds.minimumDeliverySuccessBps ? "delivery_error" :
      evidence.candidateCoverageBps < policy.thresholds.minimumCandidateCoverageBps ? "candidate_coverage" :
      evidence.fallbackDepthP95 > policy.thresholds.maximumFallbackDepthP95 ? "fallback_depth" :
      evidence.expiryRateBps > policy.thresholds.maximumExpiryRateBps ? "expiry" : null;
    if (breach) {
      reason = breach;
      capBps = Math.min(currentCap, current?.lastHealthyAllocationBps ?? policy.rollbackAllocationBps);
      action = capBps === 0 ? "deny" : "reduce";
    } else if (!current) {
      action = "hold";
    } else if (current.capBps < input.operatorAllocationBps) {
      const cooldownComplete = now.getTime()-new Date(current.updatedAt).getTime() >= policy.cooldownMs;
      action = cooldownComplete && evidence.sealedDays >= policy.recoveryDays ? "eligible_for_review" : "hold";
    }
  }

  return PilotGuardSchema.parse({
    providerId: policy.providerId, platform: policy.platform, region: policy.region,
    policyId: policy.id, policyVersion: policy.version, capBps,
    lastHealthyAllocationBps: Math.min(
      current?.lastHealthyAllocationBps ?? (action === "eligible_for_review" ? currentCap : policy.rollbackAllocationBps),
      input.operatorAllocationBps
    ),
    action, reason,
    evidenceWindowStartedAt: evidence.windowStartedAt,
    evidenceWindowEndedAt: evidence.windowEndedAt,
    revision: (current?.revision ?? 0) + 1,
    updatedAt: now.toISOString(),
    expiresAt: new Date(Math.min(new Date(policy.expiresAt).getTime(), now.getTime() + policy.maximumEvidenceAgeMs)).toISOString()
  });
}
