import {
  AdminLocaleListSchema,
  AdminOverviewSchema,
  AdminPageListSchema,
  AdminPlatformListSchema,
  AdminProviderListSchema,
  AdminRouteDetailSchema,
  AdminRouteListSchema,
  AdminRuntimeSchema,
  AdminSeoOverviewSchema,
  AdminDegradedSourceSchema,
  type AdminLocaleRevision,
  type AdminOverview,
  type AdminPageRevision,
  type AdminPlatformPresentationRevisionV2,
  type AdminPlatformList,
  type AdminProviderList,
  type AdminRouteDetail,
  type AdminRouteList,
  type AdminRoutePolicyRevision,
  type AdminRouteSummary,
  type AdminRuntime,
  type AdminSeoOverview,
  type PublishedContentSnapshot
} from "@tikdd/admin-contracts";
import type { ProviderManifest } from "@tikdd/contracts";
import type {
  AdminOverviewPersistenceMetrics,
  AttemptRouteSummary,
  CanaryHealthSummary
} from "@tikdd/persistence";
import type { PlatformDefinition } from "@tikdd/platform";
import type { CircuitSnapshot } from "@tikdd/routing-health";
import type { PilotGuardSnapshot, RolloutRule, RolloutSnapshot } from "@tikdd/rollout-control";
import { z } from "zod";

type AdminDegradedSource = z.infer<typeof AdminDegradedSourceSchema>;

export interface AdminEditorialReadSource {
  listRoutePolicies(channel: "draft" | "published", region?: string): Promise<AdminRoutePolicyRevision[]>;
  listLocales(channel: "draft" | "published"): Promise<AdminLocaleRevision[]>;
  listPages(channel: "draft" | "published", locale?: string): Promise<AdminPageRevision[]>;
  listPlatformPresentations?(channel: "draft" | "published", region?: string): Promise<AdminPlatformPresentationRevisionV2[]>;
  getActivePublishedSnapshot(deployment: string): Promise<PublishedContentSnapshot | null>;
  getOverviewMetrics(since: Date, deployment: string): Promise<AdminOverviewPersistenceMetrics>;
}

export interface AdminOperationalReadSource {
  listAttemptRouteSummaries(since: Date): Promise<AttemptRouteSummary[]>;
  listCanaryHealth(since: Date): Promise<CanaryHealthSummary[]>;
}

export interface AdminQueueReadSource {
  getJobCounts(...types: string[]): Promise<Record<string, number>>;
}

export interface AdminReadHealthSource {
  postgres(): Promise<void>;
  redis(): Promise<void>;
  queue(): Promise<void>;
  schedulerObservedAt(): Promise<string | null>;
}

export interface AdminReadServiceOptions {
  deployment: string;
  region: string;
  authMode: "password";
  manifests: readonly ProviderManifest[];
  platforms: readonly PlatformDefinition[];
  circuits: { listSnapshots(): Promise<CircuitSnapshot[]> };
  rollout: { loadSnapshot(): Promise<RolloutSnapshot> };
  guards?: { loadGuardSnapshot(): Promise<PilotGuardSnapshot> };
  guardRequired?: boolean;
  guardMaximumStaleMs?: number;
  operations: AdminOperationalReadSource;
  editorial: AdminEditorialReadSource;
  queue: AdminQueueReadSource;
  health: AdminReadHealthSource;
  readTimeoutMs: number;
  freshnessMs: number;
  now?: () => Date;
}

interface Settled<T> {
  value: T | null;
  failed: boolean;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Admin read timed out.")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

async function settled<T>(promise: Promise<T>, timeoutMs: number): Promise<Settled<T>> {
  try {
    return { value: await withTimeout(promise, timeoutMs), failed: false };
  } catch {
    return { value: null, failed: true };
  }
}

function key(providerId: string, platform: string, region: string): string {
  return `${providerId}\0${platform}\0${region}`;
}

function platformRegionKey(platform: string, region: string): string {
  return `${platform}\0${region}`;
}

function active(rule: RolloutRule, now: Date): boolean {
  return (
    new Date(rule.activatesAt) <= now &&
    (rule.expiresAt === null || new Date(rule.expiresAt) > now)
  );
}

function matches(rule: RolloutRule, providerId: string, platform: string, region: string): boolean {
  return (
    (rule.providerId === "*" || rule.providerId === providerId) &&
    (rule.platform === "*" || rule.platform === platform) &&
    (rule.region === "*" || rule.region === region)
  );
}

function specificity(rule: RolloutRule): number {
  return Number(rule.providerId !== "*") + Number(rule.platform !== "*") + Number(rule.region !== "*");
}

function allocationFor(
  snapshot: RolloutSnapshot | null,
  providerId: string,
  platform: string,
  region: string,
  now: Date
): number {
  if (!snapshot) return 0;
  const candidates = snapshot.rules.filter((rule) => active(rule, now) && matches(rule, providerId, platform, region));
  if (candidates.some((rule) => !rule.enabled)) return 0;
  const grant = candidates
    .filter((rule) => rule.enabled)
    .sort((left, right) => specificity(right) - specificity(left) || left.id.localeCompare(right.id))[0];
  return grant?.allocationBps ?? 0;
}

function guardedAllocation(input: {
  allocationBps: number;
  snapshot: PilotGuardSnapshot | null;
  providerId: string;
  platform: string;
  region: string;
  now: Date;
  required: boolean;
  maximumStaleMs: number;
}): { allocationBps: number; unavailable: boolean } {
  if (!input.required && !input.snapshot) return { allocationBps: input.allocationBps, unavailable: false };
  if (!input.snapshot) return { allocationBps: 0, unavailable: true };
  const snapshotAge = input.now.getTime() - new Date(input.snapshot.generatedAt).getTime();
  if (snapshotAge < -5_000 || snapshotAge > input.maximumStaleMs) {
    return { allocationBps: 0, unavailable: true };
  }
  const guard = input.snapshot.guards.find((candidate) =>
    candidate.providerId === input.providerId &&
    candidate.platform === input.platform &&
    candidate.region === input.region
  );
  if (!guard || new Date(guard.expiresAt) <= input.now) {
    return input.required
      ? { allocationBps: 0, unavailable: true }
      : { allocationBps: input.allocationBps, unavailable: false };
  }
  return { allocationBps: Math.min(input.allocationBps, guard.capBps), unavailable: false };
}

function stateFor(input: {
  manifestEnabled: boolean;
  allocationBps: number;
  rolloutFailed: boolean;
  guardUnavailable: boolean;
  circuitsFailed: boolean;
  circuit: CircuitSnapshot | undefined;
  now: Date;
  freshnessMs: number;
}): AdminRouteSummary["state"] {
  if (!input.manifestEnabled) return "paused";
  if (input.rolloutFailed || input.guardUnavailable || input.circuitsFailed) return "unavailable";
  if (input.allocationBps === 0) return "paused";
  if (!input.circuit || input.circuit.insufficientData) return "insufficient_data";
  if (input.now.getTime() - new Date(input.circuit.calculatedAt).getTime() > input.freshnessMs) return "stale";
  if (input.circuit.state === "open") return "open";
  if (input.circuit.successRate < 0.9) return "warning";
  return "healthy";
}

function failureCategory(code: string): AdminRouteDetail["failures"][number]["code"] {
  if (code === "provider_timeout") return "timeout";
  if (code === "provider_rate_limited") return "rate_limited";
  if (code === "provider_challenge") return "challenge";
  if (code === "provider_schema_changed") return "schema";
  if (code === "provider_unavailable") return "availability";
  if (code === "invalid_result") return "invalid_result";
  if (["content_not_found", "content_private", "authentication_required", "payment_required", "drm_protected", "geo_restricted"].includes(code)) return "terminal_content";
  return "other";
}

function uniqueSources(sources: readonly AdminDegradedSource[]): AdminDegradedSource[] {
  return [...new Set(sources)].sort();
}

export class AdminReadService {
  private readonly now: () => Date;

  constructor(private readonly options: AdminReadServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async listRoutes(): Promise<AdminRouteList> {
    const now = this.now();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    const [circuitResult, attemptResult, rolloutResult, guardResult, policyResult] = await Promise.all([
      settled(this.options.circuits.listSnapshots(), this.options.readTimeoutMs),
      settled(this.options.operations.listAttemptRouteSummaries(since), this.options.readTimeoutMs),
      settled(this.options.rollout.loadSnapshot(), this.options.readTimeoutMs),
      this.options.guards
        ? settled(this.options.guards.loadGuardSnapshot(), this.options.readTimeoutMs)
        : Promise.resolve({ value: null, failed: this.options.guardRequired === true }),
      settled(this.options.editorial.listRoutePolicies("published", this.options.region), this.options.readTimeoutMs)
    ]);
    const degraded: AdminDegradedSource[] = [];
    if (circuitResult.failed) degraded.push("routing_health");
    if (attemptResult.failed) degraded.push("operations");
    if (rolloutResult.failed) degraded.push("rollout");
    if (guardResult.failed) degraded.push("pilot_guard");
    if (policyResult.failed) degraded.push("editorial");

    const circuits = new Map((circuitResult.value ?? []).map((item) => [key(item.key.providerId, item.key.platform, item.key.region), item]));
    const attempts = new Map((attemptResult.value ?? []).map((item) => [key(item.providerId, item.platform, item.region), item]));
    const policies = new Map((policyResult.value ?? []).map((item) => [platformRegionKey(item.platform, item.region), item]));
    const routes: AdminRouteSummary[] = [];

    for (const manifest of this.options.manifests) {
      const regionMatches = manifest.regions.includes("*") || manifest.regions.includes(this.options.region);
      if (!regionMatches) continue;
      for (const capability of manifest.platforms) {
        const routeKey = key(manifest.id, capability.platform, this.options.region);
        const circuit = circuits.get(routeKey);
        const attempt = attempts.get(routeKey);
        const policy = policies.get(platformRegionKey(capability.platform, this.options.region));
        const preferenceIndex = policy?.orderedProviderIds.indexOf(manifest.id) ?? -1;
        const productionEligible = manifest.enabled && manifest.kind !== "mock" && capability.deliveryModes.length > 0;
        const operatorAllocationBps = productionEligible
          ? allocationFor(rolloutResult.value, manifest.id, capability.platform, this.options.region, now)
          : 0;
        const guarded = productionEligible ? guardedAllocation({
          allocationBps: operatorAllocationBps,
          snapshot: guardResult.value,
          providerId: manifest.id,
          platform: capability.platform,
          region: this.options.region,
          now,
          required: this.options.guardRequired === true,
          maximumStaleMs: this.options.guardMaximumStaleMs ?? 15_000
        }) : { allocationBps: 0, unavailable: false };
        routes.push({
          schemaVersion: "1",
          tuple: { providerId: manifest.id, platform: capability.platform, region: this.options.region },
          providerDisplayName: manifest.displayName,
          providerKind: manifest.kind,
          manifestEnabled: manifest.enabled,
          basePriority: capability.priority,
          deliveryModes: capability.deliveryModes,
          productionEligible,
          preferencePosition: preferenceIndex < 0 ? null : preferenceIndex + 1,
          allocationBps: guarded.allocationBps,
          state: stateFor({
            manifestEnabled: manifest.enabled,
            allocationBps: guarded.allocationBps,
            rolloutFailed: rolloutResult.failed,
            guardUnavailable: guarded.unavailable || guardResult.failed,
            circuitsFailed: circuitResult.failed,
            circuit,
            now,
            freshnessMs: this.options.freshnessMs
          }),
          rolloutRevision: rolloutResult.value && rolloutResult.value.revision > 0
            ? rolloutResult.value.revision
            : null,
          policyRevision: policy?.revision ?? null,
          circuitState: circuit?.state === "half-open" ? "half_open" : circuit?.state ?? "unknown",
          successRateBps: circuit ? Math.round(circuit.successRate * 10_000) : null,
          p50LatencyMs: null,
          p95LatencyMs: circuit?.latencyP95Ms ?? null,
          activeConcurrency: null,
          concurrencyLimit: policy?.concurrencyCaps.find(({ providerId }) => providerId === manifest.id)?.limit ?? null,
          fallbackRateBps: null,
          sampleCount: circuit?.sampleCount ?? attempt?.attemptCount ?? 0,
          observedAt: circuit?.calculatedAt ?? null
        });
      }
    }

    return AdminRouteListSchema.parse({
      schemaVersion: "1",
      generatedAt: now.toISOString(),
      degradedSources: uniqueSources(degraded),
      routes: routes.sort((left, right) =>
        left.tuple.platform.localeCompare(right.tuple.platform) ||
        (left.preferencePosition ?? 1_000) - (right.preferencePosition ?? 1_000) ||
        right.basePriority - left.basePriority ||
        left.tuple.providerId.localeCompare(right.tuple.providerId))
    });
  }

  async getRouteDetail(providerId: string, platform: string, region: string): Promise<AdminRouteDetail | null> {
    const now = this.now();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    const routeList = await this.listRoutes();
    const summary = routeList.routes.find((route) =>
      route.tuple.providerId === providerId && route.tuple.platform === platform && route.tuple.region === region);
    if (!summary) return null;
    const [attemptResult, canaryResult] = await Promise.all([
      settled(this.options.operations.listAttemptRouteSummaries(since), this.options.readTimeoutMs),
      settled(this.options.operations.listCanaryHealth(since), this.options.readTimeoutMs)
    ]);
    const attempt = attemptResult.value?.find((item) =>
      item.providerId === providerId && item.platform === platform && item.region === region);
    const failures = new Map<AdminRouteDetail["failures"][number]["code"], number>();
    for (const [code, count] of Object.entries(attempt?.failureCounts ?? {})) {
      const category = failureCategory(code);
      failures.set(category, (failures.get(category) ?? 0) + (count ?? 0));
    }
    const canary = canaryResult.value?.find((item) =>
      item.providerId === providerId && item.platform === platform && item.region === region);
    const canaryStale = canary
      ? now.getTime() - new Date(canary.lastRecordedAt).getTime() > this.options.freshnessMs
      : false;
    return AdminRouteDetailSchema.parse({
      schemaVersion: "1",
      summary,
      windowStartedAt: since.toISOString(),
      windowEndedAt: now.toISOString(),
      series: [],
      failures: [...failures].map(([code, count]) => ({ code, count })),
      canary: {
        state: canaryResult.failed
          ? "unavailable"
          : !canary
            ? "not_configured"
            : canaryStale
              ? "stale"
              : canary.latestStatus === "succeeded"
                ? "fresh"
                : "failed",
        observedAt: canary?.lastRecordedAt ?? null
      }
    });
  }

  async listProviders(): Promise<AdminProviderList> {
    const now = this.now();
    return AdminProviderListSchema.parse({
      schemaVersion: "1",
      generatedAt: now.toISOString(),
      providers: this.options.manifests.map((manifest) => ({
        schemaVersion: "1",
        id: manifest.id,
        displayName: manifest.displayName,
        kind: manifest.kind,
        enabled: manifest.enabled,
        regions: manifest.regions,
        timeoutMs: manifest.timeoutMs,
        costWeight: manifest.costWeight,
        capabilities: manifest.platforms.map(({ platform, priority, deliveryModes }) => ({
          platform,
          basePriority: priority,
          deliveryModes,
          productionEligible: manifest.enabled && manifest.kind !== "mock" && deliveryModes.length > 0
        }))
      }))
    });
  }

  async listPlatforms(): Promise<AdminPlatformList> {
    const now = this.now();
    const [routeResult, localeResult, pageResult, presentationResult] = await Promise.all([
      settled(this.listRoutes(), this.options.readTimeoutMs * 2),
      settled(this.options.editorial.listLocales("published"), this.options.readTimeoutMs),
      settled(this.options.editorial.listPages("published"), this.options.readTimeoutMs),
      settled(this.options.editorial.listPlatformPresentations?.("published", this.options.region) ?? Promise.resolve([]), this.options.readTimeoutMs)
    ]);
    const degraded: AdminDegradedSource[] = [...(routeResult.value?.degradedSources ?? [])];
    if (routeResult.failed) degraded.push("operations");
    if (localeResult.failed || pageResult.failed || presentationResult.failed) degraded.push("editorial");
    const localeCount = localeResult.value?.length ?? 0;
    const routes = routeResult.value?.routes ?? [];
    const pages = pageResult.value ?? [];
    return AdminPlatformListSchema.parse({
      schemaVersion: "1",
      generatedAt: now.toISOString(),
      degradedSources: uniqueSources(degraded),
      platforms: this.options.platforms.map((platform) => {
        const platformRoutes = routes.filter((route) => route.tuple.platform === platform.id);
        const pageLocaleCount = new Set(
          pages.filter((page) => page.pageType === "platform" && page.platform === platform.id).map(({ locale }) => locale)
        ).size;
        const contentCoverageBps = localeCount === 0 ? 0 : Math.round((pageLocaleCount / localeCount) * 10_000);
        const healthyRouteCount = platformRoutes.filter(({ state, productionEligible }) => productionEligible && state === "healthy").length;
        const presentation = presentationResult.value?.find((item) => item.platform === platform.id);
        const publicAvailability = presentation?.publicAvailability ?? (platform.status === "paused"
          ? "paused"
          : platform.status === "stable"
            ? "listed"
            : platform.status === "experimental"
              ? "preview"
              : "hidden");
        return {
          schemaVersion: "1" as const,
          id: platform.id,
          displayName: presentation?.publicDisplayName ?? platform.displayName,
          catalogStatus: platform.status,
          catalogSource: platform.source,
          recognizedHosts: platform.hosts,
          providerCount: platformRoutes.length,
          healthyRouteCount,
          publicAvailability,
          contentCoverageBps,
          seoReady: platform.status === "stable" && healthyRouteCount > 0 && contentCoverageBps === 10_000
        };
      })
    });
  }

  async listLocales(channel: "draft" | "published") {
    return AdminLocaleListSchema.parse({
      schemaVersion: "1",
      generatedAt: this.now().toISOString(),
      channel,
      locales: await withTimeout(this.options.editorial.listLocales(channel), this.options.readTimeoutMs)
    });
  }

  async listPages(channel: "draft" | "published", locale?: string) {
    return AdminPageListSchema.parse({
      schemaVersion: "1",
      generatedAt: this.now().toISOString(),
      channel,
      pages: await withTimeout(this.options.editorial.listPages(channel, locale), this.options.readTimeoutMs)
    });
  }

  async getSeoOverview(channel: "draft" | "published", locale?: string): Promise<AdminSeoOverview> {
    const pages = await withTimeout(this.options.editorial.listPages(channel, locale), this.options.readTimeoutMs);
    const summaries = pages.map((page) => {
      const blockerCount = page.state === "published" ? 0 : 1;
      return {
        pageId: page.pageId,
        locale: page.locale,
        pageType: page.pageType,
        state: page.state,
        localPath: page.seo.localPath,
        indexable: page.seo.indexable,
        includeInSitemap: page.seo.includeInSitemap,
        blockerCount
      };
    });
    return AdminSeoOverviewSchema.parse({
      schemaVersion: "1",
      generatedAt: this.now().toISOString(),
      channel,
      indexablePageCount: summaries.filter(({ indexable }) => indexable).length,
      sitemapPageCount: summaries.filter(({ includeInSitemap }) => includeInSitemap).length,
      blockerCount: summaries.reduce((sum, { blockerCount }) => sum + blockerCount, 0),
      pages: summaries
    });
  }

  async getRuntime(): Promise<AdminRuntime> {
    const now = this.now();
    const [postgres, redis, queue, scheduler, snapshot] = await Promise.all([
      settled(this.options.health.postgres(), this.options.readTimeoutMs),
      settled(this.options.health.redis(), this.options.readTimeoutMs),
      settled(this.options.health.queue(), this.options.readTimeoutMs),
      settled(this.options.health.schedulerObservedAt(), this.options.readTimeoutMs),
      settled(this.options.editorial.getActivePublishedSnapshot(this.options.deployment), this.options.readTimeoutMs)
    ]);
    const schedulerObservedAt = scheduler.value;
    const schedulerState = scheduler.failed
      ? "unavailable"
      : schedulerObservedAt === null || now.getTime() - new Date(schedulerObservedAt).getTime() > this.options.freshnessMs
        ? "stale"
        : "healthy";
    const dependencies: AdminRuntime["dependencies"] = [
      { id: "postgres", state: postgres.failed ? "unavailable" : "healthy", observedAt: postgres.failed ? null : now.toISOString() },
      { id: "redis", state: redis.failed ? "unavailable" : "healthy", observedAt: redis.failed ? null : now.toISOString() },
      { id: "queue", state: queue.failed ? "unavailable" : "healthy", observedAt: queue.failed ? null : now.toISOString() },
      { id: "scheduler", state: schedulerState, observedAt: schedulerObservedAt },
      { id: "content_snapshot", state: snapshot.failed ? "unavailable" : snapshot.value === null ? "stale" : "healthy", observedAt: snapshot.value?.generatedAt ?? null }
    ];
    const state = postgres.failed
      ? "unavailable"
      : dependencies.some(({ state: dependencyState }) => dependencyState !== "healthy")
        ? "degraded"
        : "ready";
    return AdminRuntimeSchema.parse({
      schemaVersion: "1",
      deployment: this.options.deployment,
      region: this.options.region,
      authMode: this.options.authMode,
      generatedAt: now.toISOString(),
      state,
      dependencies,
      scheduler: { state: schedulerState, observedAt: schedulerObservedAt },
      activeSnapshotRevision: snapshot.value?.revision ?? null
    });
  }

  async getOverview(): Promise<AdminOverview> {
    const now = this.now();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    const [routes, runtime, queue, metrics] = await Promise.all([
      settled(this.listRoutes(), this.options.readTimeoutMs * 2),
      this.getRuntime(),
      settled(this.options.queue.getJobCounts("waiting", "active", "completed", "failed"), this.options.readTimeoutMs),
      settled(this.options.editorial.getOverviewMetrics(since, this.options.deployment), this.options.readTimeoutMs)
    ]);
    const routeItems = routes.value?.routes ?? [];
    const queueCounts = queue.value ?? {};
    const handoffs = metrics.value?.deliveryHandoffCount ?? 0;
    const deliveryFailures = metrics.value?.deliveryFailureCount ?? 0;
    const deliveryDenominator = handoffs + deliveryFailures;
    const degradedRoutes = routeItems.filter(({ state, productionEligible }) => productionEligible && ["warning", "open", "stale", "unavailable"].includes(state)).length;
    const state = runtime.state === "unavailable"
      ? "unavailable"
      : runtime.state === "degraded" || routes.failed || queue.failed || metrics.failed || degradedRoutes > 0
        ? "warning"
        : "healthy";
    return AdminOverviewSchema.parse({
      schemaVersion: "1",
      deployment: this.options.deployment,
      region: this.options.region,
      generatedAt: now.toISOString(),
      state,
      queue: {
        queued: queueCounts.waiting ?? 0,
        active: queueCounts.active ?? 0,
        succeeded: queueCounts.completed ?? 0,
        failed: queueCounts.failed ?? 0
      },
      delivery: {
        handoffCount: handoffs,
        failureCount: deliveryFailures,
        successRateBps: deliveryDenominator === 0 ? null : Math.round((handoffs / deliveryDenominator) * 10_000)
      },
      routes: {
        total: routeItems.length,
        degraded: degradedRoutes,
        activeDenies: routeItems.filter((route) => route.productionEligible && route.manifestEnabled && route.state === "paused").length
      },
      publishing: {
        pendingDrafts: metrics.value?.pendingDraftCount ?? 0,
        localeGaps: metrics.value?.localeGapCount ?? 0,
        seoBlockers: metrics.value?.seoBlockerCount ?? 0,
        activeSnapshotRevision: metrics.value?.activeSnapshotRevision ?? runtime.activeSnapshotRevision
      },
      dependencies: runtime.dependencies
    });
  }
}
