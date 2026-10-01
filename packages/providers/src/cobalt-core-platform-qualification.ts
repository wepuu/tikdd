import {
  assessCobaltPlatformQualification,
  type CobaltPlatformQualificationAssessment,
  type CobaltPlatformQualificationEvidence
} from "./cobalt-capability-matrix";

/** Existing-platform Cobalt fallback batch for the next closed-gate qualification window. */
export const COBALT_CORE_PLATFORM_BATCH = ["x", "instagram", "tiktok", "facebook"] as const;

/**
 * Sanitized results from the 2026-10-01 closed-gate runtime windows. Work Item 130 reconfirmed
 * two TikTok tunnel results, two X direct results, two Facebook direct results and one of two
 * Instagram direct results. TikTok tunnel delivery returned attachment MP4 ranges from the local
 * direct and v2rayN exits, while the NL public-origin hairpin returned HTTP 403. Work Item 131
 * records those facts separately: user-exit portability and the reviewed tunnel boundary pass,
 * but the one-time TikDD handoff and real browser save are still pending. No production gate is
 * eligible from this evidence alone.
 */
export const COBALT_CORE_PLATFORM_QUALIFICATION_EVIDENCE: readonly CobaltPlatformQualificationEvidence[] = [
  {
    providerId: "cobalt-selfhosted",
    platform: "x",
    runtimeProbePassed: true,
    runtimeServiceAdvertised: true,
    apiKeyAllowed: true,
    serviceDisabled: false,
    samplesAttempted: 2,
    samplesResolved: 2,
    responseModes: ["redirect", "picker"],
    deliveryTopology: "direct-source",
    mediaHostPolicyVerified: true,
    mediaRangeVerified: true,
    resolverExitVerified: true,
    clientDirectExitVerified: false,
    clientProxyExitVerified: true,
    originHairpinStatus: "not-applicable",
    tunnelBoundaryVerified: false,
    localProcessingVerified: false,
    deliveryHandoffVerified: false,
    browserSaveMode: null,
    browserSaveVerified: false,
    browserStateRequired: false,
    requiresProviderPage: false,
    sourceIpBound: false,
    temporaryFailure: false,
    failures: ["cross_exit_unverified", "browser_save_unverified"]
  },
  {
    providerId: "cobalt-selfhosted",
    platform: "instagram",
    runtimeProbePassed: true,
    runtimeServiceAdvertised: true,
    apiKeyAllowed: true,
    serviceDisabled: false,
    samplesAttempted: 2,
    samplesResolved: 1,
    responseModes: ["redirect", "error"],
    deliveryTopology: "direct-source",
    mediaHostPolicyVerified: true,
    mediaRangeVerified: false,
    resolverExitVerified: false,
    clientDirectExitVerified: false,
    clientProxyExitVerified: false,
    originHairpinStatus: "not-applicable",
    tunnelBoundaryVerified: false,
    localProcessingVerified: false,
    deliveryHandoffVerified: false,
    browserSaveMode: null,
    browserSaveVerified: false,
    browserStateRequired: false,
    requiresProviderPage: false,
    sourceIpBound: false,
    temporaryFailure: false,
    failures: ["provider_error_envelope"]
  },
  {
    providerId: "cobalt-selfhosted",
    platform: "tiktok",
    runtimeProbePassed: true,
    runtimeServiceAdvertised: true,
    apiKeyAllowed: true,
    serviceDisabled: false,
    samplesAttempted: 2,
    samplesResolved: 2,
    responseModes: ["tunnel"],
    deliveryTopology: "provider-tunnel",
    mediaHostPolicyVerified: true,
    mediaRangeVerified: true,
    resolverExitVerified: false,
    clientDirectExitVerified: true,
    clientProxyExitVerified: true,
    originHairpinStatus: "blocked-unclassified",
    tunnelBoundaryVerified: true,
    localProcessingVerified: false,
    deliveryHandoffVerified: false,
    browserSaveMode: "attachment",
    browserSaveVerified: false,
    browserStateRequired: false,
    requiresProviderPage: false,
    sourceIpBound: false,
    temporaryFailure: false,
    failures: ["delivery_handoff_unverified", "browser_save_unverified"]
  },
  {
    providerId: "cobalt-selfhosted",
    platform: "facebook",
    runtimeProbePassed: true,
    runtimeServiceAdvertised: true,
    apiKeyAllowed: true,
    serviceDisabled: false,
    samplesAttempted: 2,
    samplesResolved: 2,
    responseModes: ["redirect"],
    deliveryTopology: "direct-source",
    mediaHostPolicyVerified: true,
    mediaRangeVerified: true,
    resolverExitVerified: true,
    clientDirectExitVerified: false,
    clientProxyExitVerified: true,
    originHairpinStatus: "not-applicable",
    tunnelBoundaryVerified: false,
    localProcessingVerified: false,
    deliveryHandoffVerified: false,
    browserSaveMode: null,
    browserSaveVerified: false,
    browserStateRequired: false,
    requiresProviderPage: false,
    sourceIpBound: false,
    temporaryFailure: false,
    failures: ["cross_exit_unverified", "browser_save_unverified"]
  }
];

export function assessCurrentCobaltCorePlatformQualification(): readonly CobaltPlatformQualificationAssessment[] {
  return COBALT_CORE_PLATFORM_QUALIFICATION_EVIDENCE.map(assessCobaltPlatformQualification);
}
