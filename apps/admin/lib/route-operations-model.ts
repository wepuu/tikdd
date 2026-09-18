import type { AdminBetaHealth, AdminRouteSummary } from "@tikdd/admin-contracts";
import type { AdminEffectiveRoutePlanView } from "./console-model";

export type RoutePulseState = "ready" | "observe" | "blocked" | "no-data";

export interface RouteOperationsPulse {
  platform: string;
  region: string;
  state: RoutePulseState;
  primaryProvider: string | null;
  activeProviderNames: string[];
  routeCount: number;
  activeRouteCount: number;
  healthyRouteCount: number;
  sampleCount: number;
  successRateBps: number | null;
  fallbackRateBps: number | null;
  latestObservedAt: string | null;
  beta: AdminBetaHealth["totals"] | null;
}

function weightedRate(routes: readonly AdminRouteSummary[], field: "successRateBps" | "fallbackRateBps"): number | null {
  const observed = routes.filter((route) => route.sampleCount > 0 && route[field] !== null);
  const samples = observed.reduce((sum, route) => sum + route.sampleCount, 0);
  if (samples === 0) return null;
  return Math.round(observed.reduce((sum, route) => sum + (route[field] ?? 0) * route.sampleCount, 0) / samples);
}

function latest(routes: readonly AdminRouteSummary[]): string | null {
  return routes.map(({ observedAt }) => observedAt).filter((value): value is string => value !== null).sort().at(-1) ?? null;
}

/**
 * Builds a compact, read-only view from the existing route and Beta aggregates.
 * It never probes a Provider and intentionally reports missing data as no-data.
 */
export function deriveRouteOperationsPulse(
  routes: readonly AdminRouteSummary[],
  plans: readonly AdminEffectiveRoutePlanView[],
  beta: AdminBetaHealth | null
): RouteOperationsPulse[] {
  const platforms = [...new Set(routes.map(({ tuple }) => tuple.platform))].sort();
  return platforms.map((platform) => {
    const platformRoutes = routes.filter(({ tuple }) => tuple.platform === platform);
    const plan = plans.find((candidate) => candidate.platform === platform);
    const activeRoutes = platformRoutes.filter((route) => route.productionEligible && route.allocationBps > 0 && route.state !== "paused");
    const healthyRoutes = activeRoutes.filter(({ state }) => state === "healthy");
    const routeEntries = plan?.entries.filter(({ role }) => role === "primary" || role === "fallback") ?? [];
    const activeProviderNames = routeEntries
      .filter((entry) => activeRoutes.some((route) => route.tuple.providerId === entry.providerId))
      .map(({ providerDisplayName }) => providerDisplayName);
    const bucket = beta?.byPlatform[platform as keyof typeof beta.byPlatform] ?? null;
    const sampleCount = platformRoutes.reduce((sum, route) => sum + route.sampleCount, 0);
    const degraded = activeRoutes.some(({ state }) => ["warning", "open", "stale", "unavailable"].includes(state));
    const state: RoutePulseState = activeRoutes.length === 0
      ? "blocked"
      : degraded
        ? "observe"
        : sampleCount === 0 && !bucket?.attempts.total
          ? "no-data"
          : "ready";
    return {
      platform,
      region: platformRoutes[0]?.tuple.region ?? "global",
      state,
      primaryProvider: activeProviderNames[0] ?? null,
      activeProviderNames,
      routeCount: platformRoutes.length,
      activeRouteCount: activeRoutes.length,
      healthyRouteCount: healthyRoutes.length,
      sampleCount,
      successRateBps: weightedRate(platformRoutes, "successRateBps"),
      fallbackRateBps: weightedRate(platformRoutes, "fallbackRateBps"),
      latestObservedAt: latest(platformRoutes),
      beta: bucket
    };
  });
}
