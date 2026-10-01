import {
  assessCobaltPlatformQualification,
  type CobaltPlatformQualificationAssessment,
  type CobaltPlatformQualificationEvidence
} from "./cobalt-capability-matrix";

export const COBALT_VIMEO_PINTEREST_BATCH = ["vimeo", "pinterest"] as const;

/**
 * Sanitized closed-gate evidence from the NL runtime check. The Cobalt container advertised both
 * services and the key was temporarily narrowed to this pair. Vimeo returned only upstream fetch
 * error envelopes for both attempts. Pinterest returned one redirect candidate and one upstream
 * error; the successful candidate passed NL Range validation but failed the local direct-exit
 * check. No source URL, response body, signed media URL or credential is retained here.
 */
export const COBALT_VIMEO_PINTEREST_QUALIFICATION_EVIDENCE: readonly CobaltPlatformQualificationEvidence[] =
  [
    {
      providerId: "cobalt-selfhosted" as const,
      platform: "vimeo" as const,
      runtimeProbePassed: true,
      runtimeServiceAdvertised: true,
      apiKeyAllowed: true,
      serviceDisabled: false,
      samplesAttempted: 2,
      samplesResolved: 0,
      responseModes: ["error"] as const,
      mediaHostPolicyVerified: false,
      mediaRangeVerified: false,
      crossExitVerified: false,
      browserSaveMode: null,
      browserStateRequired: false,
      requiresProviderPage: false,
      sourceIpBound: false,
      temporaryFailure: false,
      failures: ["provider_error_envelope"] as const
    },
    {
      providerId: "cobalt-selfhosted" as const,
      platform: "pinterest" as const,
      runtimeProbePassed: true,
      runtimeServiceAdvertised: true,
      apiKeyAllowed: true,
      serviceDisabled: false,
      samplesAttempted: 2,
      samplesResolved: 1,
      responseModes: ["redirect", "error"] as const,
      mediaHostPolicyVerified: true,
      mediaRangeVerified: true,
      crossExitVerified: false,
      browserSaveMode: null,
      browserStateRequired: false,
      requiresProviderPage: false,
      sourceIpBound: false,
      temporaryFailure: false,
      failures: ["provider_error_envelope", "cross_exit_unverified", "browser_save_unverified"] as const
    }
  ];

export function assessCurrentCobaltVimeoPinterestQualification(): readonly CobaltPlatformQualificationAssessment[] {
  return COBALT_VIMEO_PINTEREST_QUALIFICATION_EVIDENCE.map(assessCobaltPlatformQualification);
}
