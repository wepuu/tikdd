import type { AdminLocaleRevision, AdminPageRevision, PublishedContentSnapshot } from "./editorial";
import type { AdminOverview, AdminRouteSummary } from "./operations";
import type { AdminRoutePolicyRevision } from "./routing";

const now = "2026-08-11T12:00:00.000Z";

const baseOverview: AdminOverview = {
  schemaVersion: "1",
  deployment: "tikdd",
  region: "nl",
  generatedAt: now,
  state: "healthy",
  queue: { queued: 3, active: 2, succeeded: 1842, failed: 21 },
  delivery: { handoffCount: 921, failureCount: 14, successRateBps: 9850 },
  routes: { total: 2, degraded: 0, activeDenies: 0 },
  publishing: { pendingDrafts: 2, localeGaps: 1, seoBlockers: 1, activeSnapshotRevision: 1 },
  dependencies: [
    { id: "postgres", state: "healthy", observedAt: now },
    { id: "redis", state: "healthy", observedAt: now },
    { id: "content_snapshot", state: "healthy", observedAt: now }
  ]
};

export const ADMIN_OVERVIEW_FIXTURES = {
  healthy: baseOverview,
  empty: {
    ...baseOverview,
    queue: { queued: 0, active: 0, succeeded: 0, failed: 0 },
    delivery: { handoffCount: 0, failureCount: 0, successRateBps: null },
    routes: { total: 0, degraded: 0, activeDenies: 0 }
  },
  stale: {
    ...baseOverview,
    state: "stale" as const,
    dependencies: [{ id: "redis" as const, state: "stale" as const, observedAt: "2026-08-11T11:40:00.000Z" }]
  },
  partial: {
    ...baseOverview,
    state: "warning" as const,
    dependencies: [
      { id: "postgres" as const, state: "healthy" as const, observedAt: now },
      { id: "evidence" as const, state: "unavailable" as const, observedAt: null }
    ]
  },
  highVolume: {
    ...baseOverview,
    queue: { queued: 250_000, active: 12_000, succeeded: 900_000_000, failed: 7_500_000 }
  }
} satisfies Record<string, AdminOverview>;

const routeBase: AdminRouteSummary = {
  schemaVersion: "1",
  tuple: { providerId: "twittersaver", platform: "x", region: "nl" },
  providerDisplayName: "TwitterSaver",
  providerKind: "site-adapter",
  manifestEnabled: true,
  basePriority: 900,
  deliveryModes: ["redirect"],
  productionEligible: true,
  preferencePosition: 1,
  allocationBps: 10_000,
  state: "healthy",
  rolloutRevision: 7,
  policyRevision: 2,
  circuitState: "closed",
  successRateBps: 9725,
  p50LatencyMs: 1240,
  p95LatencyMs: 3180,
  activeConcurrency: 1,
  concurrencyLimit: 4,
  fallbackRateBps: 750,
  sampleCount: 48,
  observedAt: now
};

export const ADMIN_ROUTE_FIXTURES = {
  healthy: routeBase,
  open: { ...routeBase, state: "open" as const, circuitState: "open" as const, allocationBps: 0 },
  paused: { ...routeBase, state: "paused" as const, allocationBps: 0 },
  insufficient: { ...routeBase, state: "insufficient_data" as const, successRateBps: null, p50LatencyMs: null, p95LatencyMs: null, sampleCount: 0 },
  unavailable: { ...routeBase, state: "unavailable" as const, observedAt: null },
  longLabel: { ...routeBase, providerDisplayName: "A deliberately long Provider display name used to verify dense route layouts remain readable" }
} satisfies Record<string, AdminRouteSummary>;

export const ADMIN_ROUTE_POLICY_FIXTURE: AdminRoutePolicyRevision = {
  schemaVersion: "1",
  policyId: "rtp_x-nl",
  platform: "x",
  region: "nl",
  revision: 2,
  revisionKind: "draft",
  previousRevision: 1,
  orderedProviderIds: ["twittersaver", "ssstwitter"],
  rolloutRuleIds: ["x-nl-twittersaver", "x-nl-ssstwitter"],
  stagedAllocations: [
    { providerId: "twittersaver", allocationBps: 10_000 },
    { providerId: "ssstwitter", allocationBps: 2_500 }
  ],
  concurrencyCaps: [{ providerId: "twittersaver", limit: 4 }],
  reason: "Prefer the qualified primary route while preserving sequential fallback.",
  actorSubject: "owner_tikdd",
  createdAt: now
};

export const ADMIN_LOCALE_FIXTURES: readonly AdminLocaleRevision[] = [
  {
    schemaVersion: "1",
    locale: "en",
    revision: 1,
    displayName: "English",
    direction: "ltr",
    fallbackLocale: null,
    enabled: true,
    isDefault: true,
    state: "published",
    reason: "Seed the reviewed default locale.",
    actorSubject: "owner_tikdd",
    createdAt: now
  },
  {
    schemaVersion: "1",
    locale: "zh-CN",
    revision: 1,
    displayName: "简体中文",
    direction: "ltr",
    fallbackLocale: "en",
    enabled: true,
    isDefault: false,
    state: "published",
    reason: "Seed the reviewed Simplified Chinese locale.",
    actorSubject: "owner_tikdd",
    createdAt: now
  },
  {
    schemaVersion: "1",
    locale: "ar",
    revision: 1,
    displayName: "العربية — fixture for a right-to-left locale with intentionally longer navigation labels",
    direction: "rtl",
    fallbackLocale: "en",
    enabled: false,
    isDefault: false,
    state: "draft",
    reason: "Exercise incomplete RTL locale coverage without publishing fallback copy.",
    actorSubject: "owner_tikdd",
    createdAt: now
  }
];

export const ADMIN_HOMEPAGE_FIXTURE: AdminPageRevision = {
  schemaVersion: "1",
  pageId: "page_home",
  locale: "en",
  revision: 1,
  pageType: "homepage",
  platform: null,
  state: "published",
  content: {
    template: "homepage",
    heroTitle: "Download public videos with a clean, guided workflow",
    heroSubtitle: "Paste a supported public page link and TikDD will resolve the available formats.",
    inputLabel: "Public video page URL",
    inputPlaceholder: "Paste a supported public page link",
    primaryActionLabel: "Resolve video",
    supportedPlatformsTitle: "Supported platforms",
    howItWorksTitle: "How it works",
    howItWorksSteps: [
      { title: "Paste", description: "Enter a public page link you are authorized to use." },
      { title: "Choose", description: "Review the normalized formats returned by TikDD." }
    ],
    faqTitle: "Frequently asked questions",
    faqItems: [{ question: "Does TikDD store downloads?", answerMarkdown: "TikDD resolves supported public pages and uses short-lived delivery credentials." }]
  },
  seo: {
    localPath: "/",
    searchTitle: "TikDD public video downloader",
    searchDescription: "Resolve supported public video pages and choose an available format through TikDD's multilingual download workflow.",
    socialTitle: "TikDD public video downloader",
    socialDescription: "Resolve supported public pages with TikDD.",
    socialImageAssetId: "asset_default-social",
    indexable: true,
    includeInSitemap: true,
    redirectFrom: []
  },
  reason: "Seed the reviewed English homepage.",
  actorSubject: "owner_tikdd",
  createdAt: now
};

export const ADMIN_PUBLISHED_SNAPSHOT_FIXTURE: PublishedContentSnapshot = {
  schemaVersion: "1",
  snapshotId: "snap_11111111111111111111111111111111",
  deployment: "tikdd",
  revision: 1,
  previousSnapshotId: null,
  contentHash: "a".repeat(64),
  locales: [
    { locale: "en", displayName: "English", direction: "ltr", fallbackLocale: null, isDefault: true },
    { locale: "zh-CN", displayName: "简体中文", direction: "ltr", fallbackLocale: "en", isDefault: false }
  ],
  pages: [
    {
      pageId: ADMIN_HOMEPAGE_FIXTURE.pageId,
      locale: ADMIN_HOMEPAGE_FIXTURE.locale,
      pageType: ADMIN_HOMEPAGE_FIXTURE.pageType,
      platform: ADMIN_HOMEPAGE_FIXTURE.platform,
      content: ADMIN_HOMEPAGE_FIXTURE.content,
      seo: ADMIN_HOMEPAGE_FIXTURE.seo
    }
  ],
  sharedContent: [],
  generatedAt: now
};
