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
 * direct and v2rayN exits, but the NL public-origin exit returned HTTP 403. It therefore remains
 * fail-closed under the existing three-exit gate. No route or production gate is eligible.
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
    mediaHostPolicyVerified: true,
    mediaRangeVerified: true,
    crossExitVerified: false,
    browserSaveMode: null,
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
    mediaHostPolicyVerified: true,
    mediaRangeVerified: false,
    crossExitVerified: false,
    browserSaveMode: null,
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
    mediaHostPolicyVerified: true,
    mediaRangeVerified: true,
    crossExitVerified: false,
    browserSaveMode: "attachment",
    browserStateRequired: false,
    requiresProviderPage: false,
    sourceIpBound: false,
    temporaryFailure: false,
    failures: ["cross_exit_unverified"]
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
    mediaHostPolicyVerified: true,
    mediaRangeVerified: true,
    crossExitVerified: false,
    browserSaveMode: null,
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
