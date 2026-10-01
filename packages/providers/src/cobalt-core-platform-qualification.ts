import {
  assessCobaltPlatformQualification,
  type CobaltPlatformQualificationAssessment,
  type CobaltPlatformQualificationEvidence
} from "./cobalt-capability-matrix";

/** Existing-platform Cobalt fallback batch for the next closed-gate qualification window. */
export const COBALT_CORE_PLATFORM_BATCH = ["x", "instagram", "tiktok", "facebook"] as const;

/**
 * Evidence starts fail-closed. Runtime requests and production configuration are intentionally
 * outside this module; a later closed-gate run must replace these records with sanitized results.
 */
export const COBALT_CORE_PLATFORM_QUALIFICATION_EVIDENCE: readonly CobaltPlatformQualificationEvidence[] =
  COBALT_CORE_PLATFORM_BATCH.map((platform) => ({
    providerId: "cobalt-selfhosted" as const,
    platform,
    runtimeProbePassed: false,
    runtimeServiceAdvertised: false,
    apiKeyAllowed: false,
    serviceDisabled: false,
    samplesAttempted: 0,
    samplesResolved: 0,
    responseModes: [],
    mediaHostPolicyVerified: false,
    mediaRangeVerified: false,
    crossExitVerified: false,
    browserSaveMode: null,
    browserStateRequired: false,
    requiresProviderPage: false,
    sourceIpBound: false,
    temporaryFailure: false,
    failures: ["runtime_not_verified"]
  }));

export function assessCurrentCobaltCorePlatformQualification(): readonly CobaltPlatformQualificationAssessment[] {
  return COBALT_CORE_PLATFORM_QUALIFICATION_EVIDENCE.map(assessCobaltPlatformQualification);
}
