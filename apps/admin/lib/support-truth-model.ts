import type {
  AdminBetaHealth,
  AdminContentManagementView,
  AdminPlatformProjection,
  AdminRouteSummary,
  AdminSeoTechnicalView
} from "@tikdd/admin-contracts";
import type { AdminEffectiveRoutePlanView } from "./console-model";

export const PUBLIC_SUPPORTED_PLATFORMS = ["x", "instagram", "tiktok", "facebook", "vimeo", "pinterest", "xhamster"] as const;

export type SupportTruthDrift =
  | "catalog_route_mismatch"
  | "public_page_missing"
  | "route_not_listed"
  | "listed_without_route"
  | "public_copy_missing";

export interface SupportTruthRow {
  platform: string;
  displayName: string;
  catalogStatus: AdminPlatformProjection["catalogStatus"];
  publicAvailability: AdminPlatformProjection["publicAvailability"];
  activeProviders: string[];
  activeRouteCount: number;
  circuitOpen: boolean;
  tasks: number | null;
  taskSuccessRateBps: number | null;
  attempts: number | null;
  handoffs: number | null;
  fallbackRateBps: number | null;
  latestEventAt: string | null;
  pageId: string | null;
  pageLocaleCount: number | null;
  publishedLocaleCount: number | null;
  indexableLocaleCount: number | null;
  sitemapLocaleCount: number | null;
  publicCopyListed: boolean;
  drifts: SupportTruthDrift[];
}

function weightedFallback(routes: readonly AdminRouteSummary[]): number | null {
  const observed = routes.filter((route) => route.sampleCount > 0 && route.fallbackRateBps !== null);
  const samples = observed.reduce((sum, route) => sum + route.sampleCount, 0);
  if (samples === 0) return null;
  return Math.round(observed.reduce((sum, route) => sum + (route.fallbackRateBps ?? 0) * route.sampleCount, 0) / samples);
}

export function deriveSupportTruth(input: {
  platforms: readonly AdminPlatformProjection[];
  routes: readonly AdminRouteSummary[];
  plans: readonly AdminEffectiveRoutePlanView[];
  beta: AdminBetaHealth | null;
  content: AdminContentManagementView | null;
  seo: AdminSeoTechnicalView | null;
}): SupportTruthRow[] {
  const supported = new Set<string>(PUBLIC_SUPPORTED_PLATFORMS);
  const enabledLocales = input.content?.locales.filter(({ effective }) => effective.enabled).length ?? null;

  return input.platforms
    .filter(({ id }) => supported.has(id) || input.routes.some(({ tuple }) => tuple.platform === id))
    .map((platform) => {
      const routes = input.routes.filter(({ tuple }) => tuple.platform === platform.id);
      const activeRoutes = routes.filter((route) => route.productionEligible && route.allocationBps > 0 && route.state !== "paused");
      const plan = input.plans.find((candidate) => candidate.platform === platform.id);
      const activeProviders = (plan?.entries ?? [])
        .filter(({ role, providerId }) => (role === "primary" || role === "fallback") && activeRoutes.some((route) => route.tuple.providerId === providerId))
        .map(({ providerDisplayName }) => providerDisplayName);
      const bucket = input.beta?.byPlatform[platform.id as keyof typeof input.beta.byPlatform] ?? null;
      const definition = input.content?.definitions.find(({ platform: slug }) => slug === platform.id) ?? null;
      const coverage = definition ? input.content?.coverage.filter(({ pageId }) => pageId === definition.pageId) ?? [] : [];
      const passports = definition ? input.seo?.passports.filter(({ pageId }) => pageId === definition.pageId) ?? [] : [];
      const publishedLocaleCount = definition && input.content
        ? coverage.filter(({ status }) => status === "published").length
        : null;
      const indexableLocaleCount = definition && input.seo ? passports.filter(({ indexableEligible }) => indexableEligible).length : null;
      const sitemapLocaleCount = definition && input.seo ? passports.filter(({ sitemapEligible }) => sitemapEligible).length : null;
      const publicCopyListed = supported.has(platform.id);
      const drifts: SupportTruthDrift[] = [];

      if (activeRoutes.length > 0 && (platform.catalogStatus === "planned" || platform.catalogStatus === "paused")) drifts.push("catalog_route_mismatch");
      if (publicCopyListed && publishedLocaleCount !== null && publishedLocaleCount === 0) drifts.push("public_page_missing");
      if (activeRoutes.length > 0 && (platform.publicAvailability === "hidden" || platform.publicAvailability === "paused")) drifts.push("route_not_listed");
      if (activeRoutes.length === 0 && platform.publicAvailability === "listed") drifts.push("listed_without_route");
      if (activeRoutes.length > 0 && !publicCopyListed) drifts.push("public_copy_missing");

      return {
        platform: platform.id,
        displayName: platform.displayName,
        catalogStatus: platform.catalogStatus,
        publicAvailability: platform.publicAvailability,
        activeProviders,
        activeRouteCount: activeRoutes.length,
        circuitOpen: activeRoutes.some(({ circuitState }) => circuitState === "open"),
        tasks: bucket?.tasks.total ?? null,
        taskSuccessRateBps: bucket?.tasks.successRateBps ?? null,
        attempts: bucket?.attempts.total ?? null,
        handoffs: bucket?.deliveries.handoffCount ?? null,
        fallbackRateBps: weightedFallback(routes),
        latestEventAt: bucket?.latestEventAt ?? null,
        pageId: definition?.pageId ?? null,
        pageLocaleCount: definition ? enabledLocales : null,
        publishedLocaleCount,
        indexableLocaleCount,
        sitemapLocaleCount,
        publicCopyListed,
        drifts
      };
    })
    .sort((left, right) => {
      const leftIndex = PUBLIC_SUPPORTED_PLATFORMS.indexOf(left.platform as (typeof PUBLIC_SUPPORTED_PLATFORMS)[number]);
      const rightIndex = PUBLIC_SUPPORTED_PLATFORMS.indexOf(right.platform as (typeof PUBLIC_SUPPORTED_PLATFORMS)[number]);
      return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex) || left.platform.localeCompare(right.platform);
    });
}
