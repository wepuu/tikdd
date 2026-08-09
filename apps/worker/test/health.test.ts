import { describe, expect, it } from "vitest";
import { loadProviderHealthConfiguration } from "../src/health";

const policy = {
  version: "worker-test-v1",
  observationWindowMs: 60_000,
  minimumDistinctTasks: 3,
  thresholds: {
    integrity: { minimumFailures: 2, openRate: 0.5 },
    accessFriction: { minimumFailures: 3, openRate: 0.75 },
    availability: { minimumFailures: 3, openRate: 0.75 }
  },
  baseCooldownMs: 10_000,
  maximumCooldownMs: 60_000,
  recoverySuccesses: 2,
  snapshotTtlMs: 120_000,
  probeLeaseMs: 5_000,
  aggregationLeaseMs: 5_000
};

describe("worker provider health configuration", () => {
  it("keeps dynamic health disabled without an explicit opt-in", () => {
    expect(loadProviderHealthConfiguration({})).toEqual({
      enabled: false,
      policy: null,
      refreshIntervalMs: 10_000
    });
  });

  it("requires a reviewed runtime-validated policy when enabled", () => {
    expect(() =>
      loadProviderHealthConfiguration({ PROVIDER_HEALTH_ENABLED: "true" })
    ).toThrow("PROVIDER_HEALTH_POLICY_JSON is required");

    expect(
      loadProviderHealthConfiguration({
        PROVIDER_HEALTH_ENABLED: "true",
        PROVIDER_HEALTH_POLICY_JSON: JSON.stringify(policy),
        PROVIDER_HEALTH_REFRESH_MS: "5000"
      })
    ).toMatchObject({ enabled: true, refreshIntervalMs: 5_000, policy });

    expect(() =>
      loadProviderHealthConfiguration({
        PROVIDER_HEALTH_ENABLED: "true",
        PROVIDER_HEALTH_POLICY_JSON: JSON.stringify(policy),
        PROVIDER_HEALTH_REFRESH_MS: "6000"
      })
    ).toThrow("must not exceed");
  });
});
