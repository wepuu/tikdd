import type {
  AdminContentManagementView,
  AdminContentPublicationView,
  AdminSeoTechnicalView,
  AdminSettingsRecoveryView
} from "@tikdd/admin-contracts";

export const GROWTH_EVENT_CATALOG = [
  { name: "resolve_submit", label: "提交解析", detail: "平台 + 语言" },
  { name: "resolve_ready", label: "解析就绪", detail: "平台 + 语言" },
  { name: "resolve_failed", label: "解析失败", detail: "平台 + 语言 + 有限分类" },
  { name: "download_handoff", label: "交给浏览器", detail: "平台 + 语言" }
] as const;

type TargetPlatform = "x" | "instagram";
type CoverageStatus = "missing" | "fallback" | "draft" | "ready" | "published" | "archived";

export type GrowthPlatformSummary = {
  platform: TargetPlatform;
  label: string;
  path: string | null;
  locales: number;
  readyLocales: number;
  publishedLocales: number;
  noindexLocales: number;
  coverage: Array<{ locale: string; status: CoverageStatus }>;
};

export type GrowthReadiness = {
  status: "ready" | "partial" | "unavailable";
  platformPages: GrowthPlatformSummary[];
  enabledLocaleCount: number;
  readyCellCount: number;
  missingCellCount: number;
  analytics: "configured" | "missing";
  adsense: "configured" | "missing";
  currentRevision: number | null;
  propagationState: AdminContentPublicationView["propagationState"] | "unavailable";
  blockers: string[];
};

export type GrowthReadinessInput = {
  content: AdminContentManagementView | null;
  publication: AdminContentPublicationView | null;
  seo: AdminSeoTechnicalView | null;
  settings: AdminSettingsRecoveryView | null;
};

const labels: Record<TargetPlatform, string> = { x: "X", instagram: "Instagram" };

function platformSummary(
  platform: TargetPlatform,
  content: AdminContentManagementView,
  seo: AdminSeoTechnicalView
): GrowthPlatformSummary {
  const pageId = `page_${platform}`;
  const enabledLocales = content.locales.filter(({ effective }) => effective.enabled);
  const coverage = enabledLocales.map(({ locale }) => {
    const cell = content.coverage.find((candidate) => candidate.pageId === pageId && candidate.locale === locale);
    return { locale, status: (cell?.status ?? "missing") as CoverageStatus };
  });
  const passports = seo.passports.filter((passport) => passport.pageId === pageId);
  const pagePath = passports.find((passport) => passport.locale === enabledLocales[0]?.locale)?.canonicalPath
    ?? passports[0]?.canonicalPath
    ?? null;
  return {
    platform,
    label: labels[platform],
    path: pagePath,
    locales: coverage.length,
    readyLocales: coverage.filter(({ status }) => status === "ready" || status === "published").length,
    publishedLocales: coverage.filter(({ status }) => status === "published").length,
    noindexLocales: passports.filter(({ indexableEligible, sitemapEligible }) => !indexableEligible && !sitemapEligible).length,
    coverage
  };
}

/**
 * Builds a read-only growth readiness view from the existing Admin read models.
 * It reports preparation state, never Google traffic numbers or publishing authority.
 */
export function deriveGrowthReadiness(input: GrowthReadinessInput): GrowthReadiness {
  const { content, publication, seo, settings } = input;
  if (!content || !publication || !seo || !settings) {
    return {
      status: "unavailable",
      platformPages: [],
      enabledLocaleCount: 0,
      readyCellCount: 0,
      missingCellCount: 0,
      analytics: "missing",
      adsense: "missing",
      currentRevision: null,
      propagationState: "unavailable",
      blockers: ["read_models_unavailable"]
    };
  }

  const platformPages = (Object.keys(labels) as TargetPlatform[]).map((platform) => platformSummary(platform, content, seo));
  const blockers: string[] = [];
  if (content.readiness.missingCellCount > 0) blockers.push("content_gaps");
  if (seo.blockerCount > 0) blockers.push("seo_blockers");
  if (publication.propagationState === "propagation_failed") blockers.push("propagation_failed");
  if (publication.propagationState === "propagating") blockers.push("publication_in_progress");

  return {
    status: blockers.length ? "partial" : "ready",
    platformPages,
    enabledLocaleCount: content.readiness.enabledLocaleCount,
    readyCellCount: content.readiness.readyCellCount,
    missingCellCount: content.readiness.missingCellCount,
    analytics: settings.siteIntegrations.googleAnalyticsMeasurementId ? "configured" : "missing",
    adsense: settings.siteIntegrations.googleAdsensePublisherId ? "configured" : "missing",
    currentRevision: publication.currentRevision,
    propagationState: publication.propagationState,
    blockers: [...new Set(blockers)]
  };
}
