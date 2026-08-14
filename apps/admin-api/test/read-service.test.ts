import {
  ADMIN_HOMEPAGE_FIXTURE,
  ADMIN_LOCALE_FIXTURES,
  ADMIN_PUBLISHED_SNAPSHOT_FIXTURE
} from "@tikdd/admin-contracts/fixtures";
import type { ProviderManifest } from "@tikdd/contracts";
import type { PlatformDefinition } from "@tikdd/platform";
import type { CircuitSnapshot } from "@tikdd/routing-health";
import { assertAdminSafeValue } from "@tikdd/admin-contracts";
import { describe, expect, it } from "vitest";
import { AdminReadService, type AdminReadServiceOptions } from "../src/read-service";

const now = new Date("2026-08-11T12:00:00.000Z");
const manifest: ProviderManifest = {
  id: "twittersaver",
  displayName: "TwitterSaver",
  kind: "site-adapter",
  enabled: true,
  regions: ["nl"],
  timeoutMs: 12_000,
  costWeight: 10,
  platforms: [{ platform: "x", priority: 900, deliveryModes: ["redirect"], verificationStatus: "delivery_verified" }]
};
const platform: PlatformDefinition = {
  id: "x",
  displayName: "X",
  status: "stable",
  source: "yt-dlp",
  hosts: [{ hostname: "x.com", allowSubdomains: true }],
  extractorKeys: ["twitter"]
};
const circuit: CircuitSnapshot = {
  key: { providerId: "twittersaver", platform: "x", region: "nl" },
  state: "closed",
  successRate: 0.98,
  latencyP95Ms: 1_200,
  sampleCount: 50,
  counts: { succeeded: 49, integrity: 0, accessFriction: 1, availability: 0, neutralContentPolicy: 0, neutralCapability: 0 },
  insufficientData: false,
  reason: null,
  calculatedAt: now.toISOString(),
  windowStartedAt: new Date(now.getTime() - 60_000).toISOString(),
  lastTransitionAt: now.toISOString(),
  openedAt: null,
  openUntil: null,
  probeLeaseExpiresAt: null,
  consecutiveOpenCount: 0,
  recoverySuccessCount: 0,
  policyVersion: "test-v1",
  revision: 1
};

function options(overrides: Partial<AdminReadServiceOptions> = {}): AdminReadServiceOptions {
  return {
    deployment: "tikdd",
    region: "nl",
    authMode: "password",
    manifests: [manifest],
    platforms: [platform],
    circuits: { async listSnapshots() { return [circuit]; } },
    rollout: {
      async loadSnapshot() {
        return {
          schemaVersion: "1" as const,
          revision: 3,
          generatedAt: now.toISOString(),
          rules: [{
            id: "x-nl-twittersaver",
            providerId: "twittersaver",
            platform: "x",
            region: "nl",
            enabled: true,
            allocationBps: 10_000,
            revision: 1,
            activatesAt: new Date(now.getTime() - 60_000).toISOString(),
            expiresAt: null
          }]
        };
      }
    },
    operations: {
      async listAttemptRouteSummaries() { return [{ providerId: "twittersaver", platform: "x", region: "nl", attemptCount: 50, failureCounts: { provider_challenge: 1 } }]; },
      async listCanaryHealth() { return []; }
    },
    editorial: {
      async listRoutePolicies() { return []; },
      async listLocales() { return [...ADMIN_LOCALE_FIXTURES].filter(({ state }) => state === "published"); },
      async listPages() { return [ADMIN_HOMEPAGE_FIXTURE]; },
      async getActivePublishedSnapshot() { return ADMIN_PUBLISHED_SNAPSHOT_FIXTURE; },
      async getOverviewMetrics() {
        return { deliveryHandoffCount: 10, deliveryFailureCount: 1, pendingDraftCount: 0, localeGapCount: 0, seoBlockerCount: 0, activeSnapshotRevision: 1 };
      }
    },
    queue: { async getJobCounts() { return { waiting: 1, active: 2, completed: 10, failed: 1 }; } },
    health: {
      async postgres() {},
      async redis() {},
      async queue() {},
      async schedulerObservedAt() { return now.toISOString(); }
    },
    readTimeoutMs: 1_000,
    freshnessMs: 300_000,
    now: () => now,
    ...overrides
  };
}

describe("Admin read composition", () => {
  it("builds a healthy exact route and sanitized overview from bounded sources", async () => {
    const service = new AdminReadService(options());
    const routes = await service.listRoutes();
    expect(routes).toMatchObject({
      degradedSources: [],
      routes: [{ tuple: { providerId: "twittersaver", platform: "x", region: "nl" }, allocationBps: 10_000, state: "healthy" }]
    });
    const overview = await service.getOverview();
    expect(overview).toMatchObject({ state: "healthy", queue: { queued: 1 }, delivery: { handoffCount: 10, failureCount: 1 } });
    expect(() => assertAdminSafeValue({ routes, overview })).not.toThrow();
  });

  it("marks rollout failure unavailable instead of inventing a pause or healthy route", async () => {
    const service = new AdminReadService(options({ rollout: { async loadSnapshot() { throw new Error("unavailable"); } } }));
    const routes = await service.listRoutes();
    expect(routes.degradedSources).toContain("rollout");
    expect(routes.routes[0]).toMatchObject({ allocationBps: 0, state: "unavailable", rolloutRevision: null });
  });

  it("normalizes an empty durable rollout revision to no published revision", async () => {
    const service = new AdminReadService(options({
      rollout: {
        async loadSnapshot() {
          return { schemaVersion: "1", revision: 0, generatedAt: now.toISOString(), rules: [] };
        }
      }
    }));
    expect((await service.listRoutes()).routes[0]).toMatchObject({
      allocationBps: 0,
      state: "paused",
      rolloutRevision: null
    });
  });

  it("projects a resolution-only capability without production allocation or false degradation", async () => {
    const resolutionOnly: ProviderManifest = {
      ...manifest,
      id: "dlpanda",
      displayName: "DLPanda",
      platforms: [{ platform: "x", priority: 700, deliveryModes: [], verificationStatus: "canary_verified" }]
    };
    const service = new AdminReadService(options({ manifests: [manifest, resolutionOnly] }));
    const routes = await service.listRoutes();
    expect(routes.routes.find(({ tuple }) => tuple.providerId === "dlpanda")).toMatchObject({
      productionEligible: false,
      deliveryModes: [],
      allocationBps: 0,
      state: "paused"
    });
    expect((await service.getOverview()).routes.degraded).toBe(0);
    expect((await service.listProviders()).providers.find(({ id }) => id === "dlpanda")?.capabilities[0]).toMatchObject({
      productionEligible: false,
      deliveryModes: []
    });
  });

  it("applies the current pilot guard cap and fails closed when a required guard is missing", async () => {
    const guarded = new AdminReadService(options({
      guardRequired: true,
      guards: {
        async loadGuardSnapshot() {
          return {
            schemaVersion: "1" as const,
            revision: 4,
            generatedAt: now.toISOString(),
            guards: [{
              providerId: "twittersaver",
              platform: "x",
              region: "nl",
              policyId: "x-nl-policy",
              policyVersion: 1,
              capBps: 500,
              lastHealthyAllocationBps: 2_500,
              action: "reduce" as const,
              reason: "latency" as const,
              evidenceWindowStartedAt: new Date(now.getTime() - 60_000).toISOString(),
              evidenceWindowEndedAt: now.toISOString(),
              revision: 1,
              updatedAt: now.toISOString(),
              expiresAt: new Date(now.getTime() + 60_000).toISOString()
            }]
          };
        }
      }
    }));
    expect((await guarded.listRoutes()).routes[0]).toMatchObject({ allocationBps: 500, state: "healthy" });

    const unavailable = new AdminReadService(options({ guardRequired: true }));
    const routes = await unavailable.listRoutes();
    expect(routes.degradedSources).toContain("pilot_guard");
    expect(routes.routes[0]).toMatchObject({ allocationBps: 0, state: "unavailable" });
  });

  it("returns explicit degraded runtime and overview states for partial dependencies", async () => {
    const base = options();
    const service = new AdminReadService(options({
      health: { ...base.health, async redis() { throw new Error("redis unavailable"); } },
      queue: { async getJobCounts() { throw new Error("queue unavailable"); } }
    }));
    const runtime = await service.getRuntime();
    expect(runtime.state).toBe("degraded");
    expect(runtime.dependencies).toContainEqual(expect.objectContaining({ id: "redis", state: "unavailable" }));
    const overview = await service.getOverview();
    expect(overview.state).toBe("warning");
    expect(overview.queue).toEqual({ queued: 0, active: 0, succeeded: 0, failed: 0 });
  });
});
