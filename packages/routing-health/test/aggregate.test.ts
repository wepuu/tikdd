import { describe, expect, it } from "vitest";
import {
  aggregateCircuitHealth,
  CircuitPolicySchema,
  classifyHealthObservation,
  type CircuitPolicy,
  type CircuitSnapshot,
  type ProviderCircuitKey,
  type ProviderHealthObservation
} from "../src/index";

const key: ProviderCircuitKey = {
  providerId: "provider-a",
  platform: "x",
  region: "global"
};
const now = new Date("2026-08-07T12:00:00.000Z");
const policy: CircuitPolicy = CircuitPolicySchema.parse({
  version: "test-v1",
  observationWindowMs: 60_000,
  minimumDistinctTasks: 3,
  thresholds: {
    integrity: { minimumFailures: 2, openRate: 0.5 },
    accessFriction: { minimumFailures: 3, openRate: 0.75 },
    availability: { minimumFailures: 3, openRate: 0.75 }
  },
  baseCooldownMs: 10_000,
  maximumCooldownMs: 40_000,
  recoverySuccesses: 2,
  snapshotTtlMs: 120_000,
  probeLeaseMs: 5_000,
  aggregationLeaseMs: 5_000
});

function taskId(number: number): string {
  return `tsk_${number.toString(16).padStart(32, "0")}`;
}

function observation(
  number: number,
  status: "succeeded" | "failed",
  failureCode: ProviderHealthObservation["failureCode"],
  options: Partial<ProviderHealthObservation> = {}
): ProviderHealthObservation {
  return {
    taskId: taskId(number),
    ...key,
    status,
    failureCode,
    durationMs: number * 10,
    finishedAt: new Date(now.getTime() - (10 - number) * 1_000).toISOString(),
    ...options
  };
}

function halfOpen(previous: CircuitSnapshot): CircuitSnapshot {
  return {
    ...previous,
    state: "half-open",
    lastTransitionAt: new Date(now.getTime() - 2_000).toISOString(),
    probeLeaseExpiresAt: new Date(now.getTime() + 3_000).toISOString(),
    revision: previous.revision + 1
  };
}

describe("routing health aggregation", () => {
  it("classifies provider faults separately from neutral outcomes", () => {
    expect(classifyHealthObservation(observation(1, "failed", "invalid_result"))).toBe(
      "integrity"
    );
    expect(
      classifyHealthObservation(observation(1, "failed", "provider_challenge"))
    ).toBe("access-friction");
    expect(classifyHealthObservation(observation(1, "failed", "provider_timeout"))).toBe(
      "availability"
    );
    expect(classifyHealthObservation(observation(1, "failed", "content_private"))).toBe(
      "neutral-content-policy"
    );
    expect(classifyHealthObservation(observation(1, "failed", "unsupported_url"))).toBe(
      "neutral-capability"
    );
  });

  it("deduplicates queue retries by task and excludes neutral outcomes from health samples", () => {
    const duplicateTask = taskId(1);
    const snapshot = aggregateCircuitHealth({
      key,
      policy,
      now,
      observations: [
        observation(1, "failed", "provider_timeout", { taskId: duplicateTask }),
        observation(2, "succeeded", null, {
          taskId: duplicateTask,
          finishedAt: new Date(now.getTime() - 500).toISOString()
        }),
        observation(3, "failed", "content_private"),
        observation(4, "failed", "unsupported_url")
      ]
    });

    expect(snapshot.sampleCount).toBe(1);
    expect(snapshot.counts.succeeded).toBe(1);
    expect(snapshot.counts.availability).toBe(0);
    expect(snapshot.counts.neutralContentPolicy).toBe(1);
    expect(snapshot.counts.neutralCapability).toBe(1);
    expect(snapshot.insufficientData).toBe(true);
    expect(snapshot.state).toBe("closed");
  });

  it("opens only the exact key after minimum distinct integrity samples", () => {
    const snapshot = aggregateCircuitHealth({
      key,
      policy,
      now,
      observations: [
        observation(1, "failed", "invalid_result"),
        observation(2, "failed", "provider_schema_changed"),
        observation(3, "succeeded", null),
        observation(4, "failed", "invalid_result", { platform: "tiktok" }),
        observation(5, "failed", "invalid_result", { region: "eu-west-1" })
      ]
    });

    expect(snapshot.state).toBe("open");
    expect(snapshot.reason).toBe("integrity");
    expect(snapshot.sampleCount).toBe(3);
    expect(snapshot.openUntil).toBe("2026-08-07T12:00:10.000Z");
  });

  it("requires configured probe successes before closing a half-open circuit", () => {
    const opened = aggregateCircuitHealth({
      key,
      policy,
      now: new Date(now.getTime() - 5_000),
      observations: [
        observation(1, "failed", "invalid_result"),
        observation(2, "failed", "provider_schema_changed"),
        observation(3, "succeeded", null)
      ]
    });
    const previous = halfOpen(opened);
    const oneSuccess = aggregateCircuitHealth({
      key,
      policy,
      previous,
      now,
      observations: [
        observation(6, "succeeded", null, {
          finishedAt: new Date(now.getTime() - 1_000).toISOString()
        })
      ]
    });
    expect(oneSuccess.state).toBe("half-open");
    expect(oneSuccess.recoverySuccessCount).toBe(1);

    const recovered = aggregateCircuitHealth({
      key,
      policy,
      previous,
      now,
      observations: [
        observation(6, "succeeded", null, {
          finishedAt: new Date(now.getTime() - 1_000).toISOString()
        }),
        observation(7, "succeeded", null, {
          finishedAt: new Date(now.getTime() - 500).toISOString()
        })
      ]
    });
    expect(recovered.state).toBe("closed");
    expect(recovered.consecutiveOpenCount).toBe(0);
  });

  it("reopens on a probe provider fault with bounded cooldown growth", () => {
    const opened = aggregateCircuitHealth({
      key,
      policy,
      now: new Date(now.getTime() - 5_000),
      observations: [
        observation(1, "failed", "invalid_result"),
        observation(2, "failed", "provider_schema_changed"),
        observation(3, "succeeded", null)
      ]
    });
    const reopened = aggregateCircuitHealth({
      key,
      policy,
      previous: halfOpen(opened),
      now,
      observations: [
        observation(8, "failed", "provider_timeout", {
          finishedAt: new Date(now.getTime() - 500).toISOString()
        })
      ]
    });

    expect(reopened.state).toBe("open");
    expect(reopened.reason).toBe("availability");
    expect(reopened.consecutiveOpenCount).toBe(2);
    expect(reopened.openUntil).toBe("2026-08-07T12:00:20.000Z");
  });
});
