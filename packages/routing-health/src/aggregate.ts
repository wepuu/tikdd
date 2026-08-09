import type { ProviderFailureCode } from "@tikdd/contracts";
import {
  CircuitPolicySchema,
  CircuitSnapshotSchema,
  ProviderCircuitKeySchema,
  ProviderHealthObservationSchema,
  type CircuitCounts,
  type CircuitPolicy,
  type CircuitSnapshot,
  type HealthFailureGroup,
  type ProviderCircuitKey,
  type ProviderHealthObservation
} from "./model";

type ObservationClass =
  | "succeeded"
  | HealthFailureGroup
  | "neutral-content-policy"
  | "neutral-capability";

const integrityFailures = new Set<ProviderFailureCode>([
  "provider_schema_changed",
  "invalid_result"
]);
const accessFrictionFailures = new Set<ProviderFailureCode>([
  "provider_challenge",
  "provider_rate_limited"
]);
const availabilityFailures = new Set<ProviderFailureCode>([
  "provider_timeout",
  "provider_unavailable",
  "internal_error"
]);

export function classifyHealthObservation(
  observation: ProviderHealthObservation
): ObservationClass {
  const parsed = ProviderHealthObservationSchema.parse(observation);
  if (parsed.status === "succeeded") {
    return "succeeded";
  }
  const failureCode = parsed.failureCode;
  if (failureCode === null) {
    throw new Error("A failed health observation requires a failure code.");
  }
  if (integrityFailures.has(failureCode)) {
    return "integrity";
  }
  if (accessFrictionFailures.has(failureCode)) {
    return "access-friction";
  }
  if (availabilityFailures.has(failureCode)) {
    return "availability";
  }
  if (failureCode === "unsupported_url" || failureCode === "invalid_url") {
    return "neutral-capability";
  }
  return "neutral-content-policy";
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? 0;
}

function emptyCounts(): CircuitCounts {
  return {
    succeeded: 0,
    integrity: 0,
    accessFriction: 0,
    availability: 0,
    neutralContentPolicy: 0,
    neutralCapability: 0
  };
}

function sameKey(
  observation: ProviderHealthObservation,
  key: ProviderCircuitKey
): boolean {
  return (
    observation.providerId === key.providerId &&
    observation.platform === key.platform &&
    observation.region === key.region
  );
}

function latestDistinctTaskObservations(
  observations: readonly ProviderHealthObservation[],
  key: ProviderCircuitKey,
  windowStartedAt: Date,
  now: Date
): ProviderHealthObservation[] {
  const latest = new Map<string, ProviderHealthObservation>();
  for (const rawObservation of observations) {
    const observation = ProviderHealthObservationSchema.parse(rawObservation);
    const finishedAt = new Date(observation.finishedAt);
    if (
      !sameKey(observation, key) ||
      finishedAt < windowStartedAt ||
      finishedAt > now
    ) {
      continue;
    }
    const existing = latest.get(observation.taskId);
    if (!existing || observation.finishedAt > existing.finishedAt) {
      latest.set(observation.taskId, observation);
    }
  }
  return [...latest.values()].sort((left, right) =>
    left.finishedAt.localeCompare(right.finishedAt)
  );
}

function openingReason(
  counts: CircuitCounts,
  sampleCount: number,
  policy: CircuitPolicy
): HealthFailureGroup | null {
  if (sampleCount < policy.minimumDistinctTasks || sampleCount === 0) {
    return null;
  }
  const candidates: Array<{
    group: HealthFailureGroup;
    count: number;
    minimumFailures: number;
    openRate: number;
  }> = [
    { group: "integrity", count: counts.integrity, ...policy.thresholds.integrity },
    {
      group: "access-friction",
      count: counts.accessFriction,
      ...policy.thresholds.accessFriction
    },
    { group: "availability", count: counts.availability, ...policy.thresholds.availability }
  ];
  return (
    candidates.find(
      ({ count, minimumFailures, openRate }) =>
        count >= minimumFailures && count / sampleCount >= openRate
    )?.group ?? null
  );
}

function cooldownMs(policy: CircuitPolicy, consecutiveOpenCount: number): number {
  const multiplier = 2 ** Math.max(0, consecutiveOpenCount - 1);
  return Math.min(policy.maximumCooldownMs, policy.baseCooldownMs * multiplier);
}

export interface AggregateCircuitHealthInput {
  key: ProviderCircuitKey;
  observations: readonly ProviderHealthObservation[];
  policy: CircuitPolicy;
  previous?: CircuitSnapshot | null;
  now?: Date;
}

export function aggregateCircuitHealth(input: AggregateCircuitHealthInput): CircuitSnapshot {
  const key = ProviderCircuitKeySchema.parse(input.key);
  const policy = CircuitPolicySchema.parse(input.policy);
  const now = input.now ?? new Date();
  const previous = input.previous ? CircuitSnapshotSchema.parse(input.previous) : null;
  const windowStartedAt = new Date(now.getTime() - policy.observationWindowMs);
  const observations = latestDistinctTaskObservations(
    input.observations,
    key,
    windowStartedAt,
    now
  );
  const counts = emptyCounts();

  for (const observation of observations) {
    switch (classifyHealthObservation(observation)) {
      case "succeeded":
        counts.succeeded += 1;
        break;
      case "integrity":
        counts.integrity += 1;
        break;
      case "access-friction":
        counts.accessFriction += 1;
        break;
      case "availability":
        counts.availability += 1;
        break;
      case "neutral-capability":
        counts.neutralCapability += 1;
        break;
      case "neutral-content-policy":
        counts.neutralContentPolicy += 1;
        break;
    }
  }

  const sampleCount =
    counts.succeeded + counts.integrity + counts.accessFriction + counts.availability;
  const successRate = sampleCount === 0 ? 0 : counts.succeeded / sampleCount;
  const latencyP95Ms = percentile95(observations.map(({ durationMs }) => durationMs));
  const calculatedAt = now.toISOString();
  const base = {
    key,
    successRate,
    latencyP95Ms,
    sampleCount,
    counts,
    insufficientData: sampleCount < policy.minimumDistinctTasks,
    calculatedAt,
    windowStartedAt: windowStartedAt.toISOString(),
    policyVersion: policy.version,
    revision: previous?.revision ?? 0
  };

  if (previous?.state === "half-open") {
    const transitionAt = new Date(previous.lastTransitionAt);
    const probeObservations = observations.filter(
      ({ finishedAt }) => new Date(finishedAt) >= transitionAt
    );
    const providerFault = probeObservations.some((observation) => {
      const classification = classifyHealthObservation(observation);
      return (
        classification === "integrity" ||
        classification === "access-friction" ||
        classification === "availability"
      );
    });
    const recoverySuccessCount = probeObservations.filter(
      (observation) => classifyHealthObservation(observation) === "succeeded"
    ).length;

    if (providerFault) {
      const consecutiveOpenCount = previous.consecutiveOpenCount + 1;
      return CircuitSnapshotSchema.parse({
        ...base,
        state: "open",
        reason:
          probeObservations
            .map(classifyHealthObservation)
            .find(
              (classification): classification is HealthFailureGroup =>
                classification === "integrity" ||
                classification === "access-friction" ||
                classification === "availability"
            ) ?? "availability",
        lastTransitionAt: calculatedAt,
        openedAt: calculatedAt,
        openUntil: new Date(
          now.getTime() + cooldownMs(policy, consecutiveOpenCount)
        ).toISOString(),
        probeLeaseExpiresAt: null,
        consecutiveOpenCount,
        recoverySuccessCount: 0
      });
    }

    if (recoverySuccessCount >= policy.recoverySuccesses) {
      return CircuitSnapshotSchema.parse({
        ...base,
        state: "closed",
        reason: null,
        lastTransitionAt: calculatedAt,
        openedAt: null,
        openUntil: null,
        probeLeaseExpiresAt: null,
        consecutiveOpenCount: 0,
        recoverySuccessCount
      });
    }

    return CircuitSnapshotSchema.parse({
      ...base,
      state: "half-open",
      reason: previous.reason,
      lastTransitionAt: previous.lastTransitionAt,
      openedAt: previous.openedAt,
      openUntil: previous.openUntil,
      probeLeaseExpiresAt: previous.probeLeaseExpiresAt,
      consecutiveOpenCount: previous.consecutiveOpenCount,
      recoverySuccessCount
    });
  }

  if (previous?.state === "open") {
    return CircuitSnapshotSchema.parse({
      ...base,
      state: "open",
      reason: previous.reason,
      lastTransitionAt: previous.lastTransitionAt,
      openedAt: previous.openedAt,
      openUntil: previous.openUntil,
      probeLeaseExpiresAt: null,
      consecutiveOpenCount: previous.consecutiveOpenCount,
      recoverySuccessCount: 0
    });
  }

  const reason = openingReason(counts, sampleCount, policy);
  if (reason) {
    const consecutiveOpenCount = 1;
    return CircuitSnapshotSchema.parse({
      ...base,
      state: "open",
      reason,
      lastTransitionAt: calculatedAt,
      openedAt: calculatedAt,
      openUntil: new Date(now.getTime() + cooldownMs(policy, consecutiveOpenCount)).toISOString(),
      probeLeaseExpiresAt: null,
      consecutiveOpenCount,
      recoverySuccessCount: 0
    });
  }

  return CircuitSnapshotSchema.parse({
    ...base,
    state: "closed",
    reason: null,
    lastTransitionAt: previous?.lastTransitionAt ?? calculatedAt,
    openedAt: null,
    openUntil: null,
    probeLeaseExpiresAt: null,
    consecutiveOpenCount: 0,
    recoverySuccessCount: 0
  });
}
