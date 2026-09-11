import type {
  AdminContentManagementView,
  AdminContentPublicationView,
  AdminSeoTechnicalView,
  AdminSettingsRecoveryView
} from "@tikdd/admin-contracts";

export type PublicationCenterInput = {
  content: AdminContentManagementView | null;
  publication: AdminContentPublicationView | null;
  seo: AdminSeoTechnicalView | null;
  settings: AdminSettingsRecoveryView | null;
};

export type PublicationCenterStatus = "ready" | "blocked" | "propagating" | "unavailable";

export type PublicationCenterOverview = {
  status: PublicationCenterStatus;
  draftCount: number;
  readyPageCount: number;
  missingCellCount: number;
  seoBlockerCount: number;
  affectedPathCount: number;
  diffCount: number;
  integrationCount: number;
  configuredIntegrationCount: number;
  currentRevision: number | null;
  pendingSnapshotId: string | null;
  blockers: string[];
};

function configuredIntegrations(settings: AdminSettingsRecoveryView | null): number {
  if (!settings) return 0;
  return [
    settings.siteIntegrations.googleAnalyticsMeasurementId,
    settings.siteIntegrations.googleAdsensePublisherId
  ].filter(Boolean).length;
}

/**
 * Derives the operator-facing publication state from existing read models.
 * It deliberately does not infer health or eligibility when one of the sources is missing.
 */
export function derivePublicationCenter(input: PublicationCenterInput): PublicationCenterOverview {
  const { content, publication, seo, settings } = input;
  const blockers = [
    ...(publication?.blockers ?? []),
    ...(seo && seo.blockerCount > 0 ? ["seo_blockers"] : []),
    ...(content && content.readiness.missingCellCount > 0 ? ["content_gaps"] : []),
    ...(publication?.propagationState === "propagation_failed" ? ["propagation_failed"] : [])
  ];
  const propagation = publication?.propagationState ?? "idle";
  const status: PublicationCenterStatus = !publication || !content
    ? "unavailable"
      : propagation === "propagating"
        ? "propagating"
      : blockers.length > 0
        ? "blocked"
        : "ready";

  return {
    status,
    draftCount: publication?.draftCount ?? 0,
    readyPageCount: publication?.readyPageCount ?? 0,
    missingCellCount: content?.readiness.missingCellCount ?? 0,
    seoBlockerCount: seo?.blockerCount ?? 0,
    affectedPathCount: publication?.affectedPaths?.length ?? 0,
    diffCount: publication?.diff?.length ?? 0,
    integrationCount: 2,
    configuredIntegrationCount: configuredIntegrations(settings),
    currentRevision: publication?.currentRevision ?? null,
    pendingSnapshotId: publication?.pendingSnapshotId ?? null,
    blockers: [...new Set(blockers)]
  };
}
