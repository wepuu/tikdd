import type { ProviderManifest } from "@tikdd/providers";
import type { CircuitSnapshot } from "@tikdd/routing-health";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerProviderHealthDiagnostics } from "../src/provider-health-diagnostics";

const token = "diagnostic-token-with-at-least-32-characters";
const snapshot: CircuitSnapshot = {
  key: { providerId: "provider-a", platform: "x", region: "global" },
  state: "open", successRate: 0.2, latencyP95Ms: 1200, sampleCount: 5,
  counts: { succeeded: 1, integrity: 4, accessFriction: 0, availability: 0, neutralContentPolicy: 0, neutralCapability: 0 },
  insufficientData: false, reason: "integrity", calculatedAt: "2026-08-07T12:00:00.000Z",
  windowStartedAt: "2026-08-07T11:59:00.000Z", lastTransitionAt: "2026-08-07T12:00:00.000Z",
  openedAt: "2026-08-07T12:00:00.000Z", openUntil: "2026-08-07T12:01:00.000Z",
  probeLeaseExpiresAt: null, consecutiveOpenCount: 1, recoverySuccessCount: 0,
  policyVersion: "test-v1", revision: 2
};
const manifest: ProviderManifest = {
  id: "provider-a", displayName: "Provider A", kind: "api", enabled: true, regions: ["*"],
  timeoutMs: 1000, costWeight: 1, platforms: [{ platform: "x", priority: 50, deliveryModes: ["redirect"] }]
};

function appWith(configuredToken: string | null) {
  const app = Fastify();
  registerProviderHealthDiagnostics(app, {
    token: configuredToken, region: "global", manifests: [manifest],
    store: { async listSnapshots() { return [snapshot]; } },
    operations: {
      async listAttemptRouteSummaries() { return [{ providerId: "provider-a", platform: "x", region: "global", attemptCount: 7, failureCounts: { invalid_result: 2 } }]; },
      async getFallbackDepthSummary() { return { taskCount: 5, averageDepth: 0.4, p95Depth: 1, maximumDepth: 2 }; },
      async listCanaryHealth() { return [{ canaryId: "authorized-x", providerId: "provider-a", platform: "x", region: "canary-global", sampleCount: 3, successCount: 2, latestStatus: "succeeded" as const, latestFailureCode: null, latencyP95Ms: 900, averageFormatCount: 4, minimumLinkLifetimeMs: 60000, averageFallbackDepth: 0.33, lastRecordedAt: "2026-08-09T00:00:00.000Z", failureCounts: { provider_timeout: 1 } }]; }
    },
    rollout: { async loadSnapshot() { return { schemaVersion: "1" as const, revision: 3, generatedAt: new Date().toISOString(), rules: [] }; } }
  });
  return app;
}

describe("provider health diagnostics", () => {
  it("does not register without an explicit credential", async () => {
    const app = appWith(null);
    try { expect((await app.inject({ method: "GET", url: "/internal/v1/provider-health" })).statusCode).toBe(404); }
    finally { await app.close(); }
  });
  it("rejects missing credentials", async () => {
    const app = appWith(token);
    try { expect((await app.inject({ method: "GET", url: "/internal/v1/provider-health" })).statusCode).toBe(401); }
    finally { await app.close(); }
  });
  it("returns operational metadata without private data", async () => {
    const app = appWith(token);
    try {
      const response = await app.inject({ method: "GET", url: "/internal/v1/provider-health", headers: { authorization: `Bearer ${token}` } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ rollout: { revision: 3 }, fallbackDepth: { p95Depth: 1 }, routes: [{ providerId: "provider-a", staticPriority: 50, circuit: { state: "open" } }], canaries: [{ canaryId: "authorized-x", sampleCount: 3 }] });
      expect(response.body).not.toMatch(/canonicalUrl|sourceUrl|targetUrl|token|digest|thumbnail/i);
    } finally { await app.close(); }
  });
});
