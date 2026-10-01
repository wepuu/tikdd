import {
  assessCobaltPlatformQualification,
  type CobaltPlatformQualificationAssessment,
  type CobaltPlatformQualificationEvidence
} from "./cobalt-capability-matrix";

/** Existing-platform Cobalt fallback batch for the next closed-gate qualification window. */
export const COBALT_CORE_PLATFORM_BATCH = ["x", "instagram", "tiktok", "facebook"] as const;

/**
 * Sanitized results from the 2026-10-01 closed-gate runtime window. The runtime was healthy and
 * the production UA/key was accepted, but no platform met the three-exit plus browser-save gate:
 * X and Facebook were readable from NL/v2rayN but timed out from the local direct exit; Instagram
 * returned one successful redirect and one upstream empty-result envelope; TikTok returned only
 * Cobalt tunnel URLs. No route or production gate is eligible from this evidence.
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
    mediaHostPolicyVerified: false,
    mediaRangeVerified: false,
    crossExitVerified: false,
    browserSaveMode: null,
    browserStateRequired: false,
    requiresProviderPage: false,
    sourceIpBound: false,
    temporaryFailure: false,
    failures: ["non_portable_result"]
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
