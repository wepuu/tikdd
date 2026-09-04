import type { ProviderRouter } from "@tikdd/providers";
import { describe, expect, it } from "vitest";
import type { CanarySchedulerConfiguration } from "../src/configuration";
import { runCanaries } from "../src/runner";
import { classifyCanaryExecution } from "../src/supervision";

const configuration: CanarySchedulerConfiguration = {
  deployment: "test", region: "canary-global", intervalMs: 300000, leaseTtlMs: 15000,
  runTimeoutMs: 10000, measurementRetentionMs: 86400000, rolloutMaximumStaleMs: 15000,
  rolloutCohortKey: Buffer.alloc(32), scheduled: true
};

describe("scheduled canary runner", () => {
  it("does nothing when another scheduler owns the lease", async () => {
    const measurements: unknown[] = [];
    const result = await runCanaries({
      definitions: [{ id: "authorized-x", provider: "provider-a", platform: "x", url: "https://x.com/example/status/1" }],
      router: {} as ProviderRouter,
      repository: { recordCanaryMeasurement: async (value: unknown) => { measurements.push(value); } } as never,
      leaseSource: { acquire: async () => null }, configuration
    });
    expect(result.leaseAcquired).toBe(false);
    expect(measurements).toHaveLength(0);
  });

  it("persists only the normalized measurement fields", async () => {
    const measurements: Record<string, unknown>[] = [];
    const router = {
      async resolve() {
        return {
          attempts: [{ providerId: "provider-a" }],
          resolution: {
            result: { provenance: { provider: "provider-a" }, formats: [{ id: "fmt" }] },
            candidates: [{ expiresAt: new Date(Date.now() + 60000).toISOString() }]
          }
        };
      }
    } as unknown as ProviderRouter;
    const result = await runCanaries({
      definitions: [{ id: "authorized-x", provider: "provider-a", platform: "x", url: "https://x.com/example/status/1" }],
      router,
      repository: { recordCanaryMeasurement: async (value: Record<string, unknown>) => { measurements.push(value); } } as never,
      leaseSource: { acquire: async () => ({ release: async () => undefined }) }, configuration
    });
    expect(result.succeeded).toBe(1);
    expect(measurements[0]).toMatchObject({ canaryId: "authorized-x", providerId: "provider-a", status: "succeeded", formatCount: 1, attemptCount: 1 });
    expect(JSON.stringify(measurements[0])).not.toMatch(/sourceUrl|canonicalUrl|targetUrl|title|thumbnail/i);
  });

  it("keeps a canary pinned to its declared Provider", async () => {
    const calls: string[] = [];
    const providerRouter = { async resolve() { calls.push("provider-a"); throw new Error("fixture failure"); } } as unknown as ProviderRouter;
    const result = await runCanaries({
      definitions: [{ id: "authorized-x", provider: "provider-a", platform: "x", url: "https://x.com/example/status/1" }],
      router: { async resolve() { calls.push("fallback-router"); } } as unknown as ProviderRouter,
      routerForProvider: (providerId) => providerId === "provider-a" ? providerRouter : null,
      repository: { recordCanaryMeasurement: async () => undefined } as never,
      leaseSource: { acquire: async () => ({ release: async () => undefined }) }, configuration
    });
    expect(calls).toEqual(["provider-a"]);
    expect(result.failed).toBe(1);
  });

  it("keeps scheduler success separate from a failed Provider measurement", () => {
    expect(classifyCanaryExecution({
      runId: "run", leaseAcquired: true, sampleCount: 1, succeeded: 0, failed: 1, durationMs: 100, errorCount: 0
    })).toMatchObject({ state: "completed", leaseState: "released", lastErrorCode: null });
  });
});
