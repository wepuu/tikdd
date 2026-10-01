import {
  assessCobaltPlatformQualification,
  type CobaltPlatformQualificationAssessment,
  type CobaltPlatformQualificationEvidence
} from "./cobalt-capability-matrix";

export const COBALT_VIMEO_PINTEREST_BATCH = ["vimeo", "pinterest"] as const;

/**
 * Closed-gate starting records for WI127. No Cobalt runtime sample has been executed by this
 * commit; these records intentionally remain deferred until the private key allowlist and runtime
 * service discovery are reviewed on NL. They contain no sample or media identifiers.
 */
export const COBALT_VIMEO_PINTEREST_QUALIFICATION_EVIDENCE: readonly CobaltPlatformQualificationEvidence[] =
  COBALT_VIMEO_PINTEREST_BATCH.map((platform) => ({
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

export function assessCurrentCobaltVimeoPinterestQualification(): readonly CobaltPlatformQualificationAssessment[] {
  return COBALT_VIMEO_PINTEREST_QUALIFICATION_EVIDENCE.map(assessCobaltPlatformQualification);
}
