import {
  ADMIN_OVERVIEW_FIXTURES,
  ADMIN_ROUTE_FIXTURES
} from "@tikdd/admin-contracts/fixtures";
import type {
  AdminPlatformList,
  AdminOperationalTruth,
  AdminProviderList,
  AdminRouteDetail,
  AdminRouteList,
  AdminRuntime,
  AdminSeoOverview
} from "@tikdd/admin-contracts";
import { AdminConsoleSnapshotSchema } from "../lib/console-contract";

export const generatedAt = "2026-08-11T12:00:00.000Z";

export const routeList: AdminRouteList = {
  schemaVersion: "1",
  generatedAt,
  degradedSources: [],
  routes: [ADMIN_ROUTE_FIXTURES.open, ADMIN_ROUTE_FIXTURES.healthy]
};

export const routeDetail: AdminRouteDetail = {
  schemaVersion: "1",
  summary: ADMIN_ROUTE_FIXTURES.open,
  windowStartedAt: "2026-08-11T11:00:00.000Z",
  windowEndedAt: generatedAt,
  series: [],
  failures: [{ code: "challenge", count: 3 }],
  canary: { state: "stale", observedAt: "2026-08-11T11:30:00.000Z" }
};

export const providers: AdminProviderList = {
  schemaVersion: "1",
  generatedAt,
  providers: [{
    schemaVersion: "1",
    id: "twittersaver",
    displayName: "TwitterSaver",
    kind: "site-adapter",
    enabled: true,
    regions: ["nl"],
    timeoutMs: 12_000,
    costWeight: 10,
    capabilities: [{ platform: "x", basePriority: 900, deliveryModes: ["redirect"], verificationStatus: "delivery_verified", productionEligible: true }]
  }]
};

export const platforms: AdminPlatformList = {
  schemaVersion: "1",
  generatedAt,
  degradedSources: [],
  platforms: [{
    schemaVersion: "1",
    id: "x",
    displayName: "X",
    catalogStatus: "stable",
    catalogSource: "yt-dlp",
    recognizedHosts: [{ hostname: "x.com", allowSubdomains: true }],
    providerCount: 1,
    healthyRouteCount: 0,
    publicAvailability: "listed",
    contentCoverageBps: 5_000,
    seoReady: false
  }]
};

export const runtime: AdminRuntime = {
  schemaVersion: "1",
  deployment: "tikdd",
  region: "nl",
  authMode: "password",
  generatedAt,
  state: "degraded",
  dependencies: [
    { id: "postgres", state: "healthy", observedAt: generatedAt },
    { id: "scheduler", state: "stale", observedAt: "2026-08-11T11:00:00.000Z" }
  ],
  scheduler: { state: "stale", observedAt: "2026-08-11T11:00:00.000Z" },
  activeSnapshotRevision: 1
};

export const seo: AdminSeoOverview = {
  schemaVersion: "1",
  generatedAt,
  channel: "published",
  indexablePageCount: 1,
  sitemapPageCount: 1,
  blockerCount: 1,
  pages: []
};

export const operationalTruth: AdminOperationalTruth = {
  schemaVersion: "1",
  deployment: "tikdd",
  region: "nl",
  generatedAt,
  degradedSources: [],
  services: (["canary", "evidence", "cleanup"] as const).map((service) => ({
    service, state: "completed", freshness: "fresh", ready: true, observedAt: generatedAt,
    nextExpectedAt: "2026-08-11T12:15:00.000Z", consecutiveFailures: 0
  })),
  platforms: [{
    platform: "x", displayName: "X", region: "nl", catalogStatus: "stable", publicAvailability: "listed",
    contentCoverageBps: 5_000, currentAvailability: "unavailable", indexEligibility: "ineligible",
    ladder: (["catalog", "resolution", "delivery", "canary", "runtime", "lifecycle", "seo"] as const).map((id) => ({
      id, state: id === "catalog" || id === "resolution" || id === "delivery" || id === "lifecycle" ? "pass" : "block", observedAt: null
    })),
    reasons: [{ code: "open_circuit", providerId: "twittersaver" }, { code: "content_incomplete", providerId: null }],
    providers: [{
      tuple: { providerId: "twittersaver", platform: "x", region: "nl" }, displayName: "TwitterSaver",
      manifestEnabled: true, regionEligible: true, resolutionCapable: true, deliveryModes: ["redirect"], deliveryVerified: true,
      canaryState: "stale", canaryObservedAt: "2026-08-11T11:30:00.000Z", allocationBps: 10_000, guardAction: null,
      circuitState: "open", runtimeState: "open", reasons: ["canary_stale", "open_circuit"]
    }]
  }]
};

export const consoleSnapshot = AdminConsoleSnapshotSchema.parse({
  schemaVersion: "1",
  generatedAt,
  refreshIntervalMs: 30_000,
  overview: { status: "ready", data: ADMIN_OVERVIEW_FIXTURES.healthy },
  operationalTruth: { status: "ready", data: operationalTruth },
  routes: { status: "ready", data: routeList },
  selectedRoute: { status: "ready", data: routeDetail },
  qualification: { status: "ready", data: null },
  providers: { status: "ready", data: providers },
  platforms: { status: "ready", data: platforms },
  runtime: { status: "ready", data: runtime },
  seo: { status: "ready", data: seo },
  controls: { status: "ready", data: {
    csrf: { schemaVersion: "1", csrfToken: `v1.${"a".repeat(40)}.${"b".repeat(43)}`, expiresInSeconds: 300 },
    routePolicy: {
      schemaVersion: "1", platform: "x", region: "nl", headRevision: null,
      baselineProviderIds: ["twittersaver"], effectiveProviderIds: ["twittersaver"], technicalProviderIds: [], excludedProviders: [],
      published: null, draft: null,
      propagation: { state: "propagated", durableRevision: null, projectedRevision: null }
    },
    platformPresentation: null,
    contentManagement: null,
    contentPublication: null,
    seoTechnical: null
    ,settingsRecovery: null
  } }
});
