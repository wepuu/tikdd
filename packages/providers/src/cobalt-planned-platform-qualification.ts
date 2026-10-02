import {
  assessCobaltPlatformQualification,
  type CobaltPlatformQualificationAssessment,
  type CobaltPlatformQualificationEvidence
} from "./cobalt-capability-matrix";

/** Work Item 137 closed-gate qualification batch. Source and media URLs are never retained here. */
export const COBALT_PLANNED_PLATFORM_BATCH = ["dailymotion", "reddit", "vk"] as const;

export const COBALT_PLANNED_PLATFORM_QUALIFICATION_EVIDENCE: readonly CobaltPlatformQualificationEvidence[] = [
  {
    providerId: "cobalt-selfhosted",
    platform: "dailymotion",
    runtimeProbePassed: true,
    runtimeServiceAdvertised: true,
    apiKeyAllowed: true,
    serviceDisabled: false,
    samplesAttempted: 2,
    samplesResolved: 2,
    responseModes: ["tunnel", "tunnel"],
    deliveryTopology: "provider-tunnel",
    mediaHostPolicyVerified: true,
    mediaRangeVerified: false,
    resolverExitVerified: false,
    clientDirectExitVerified: false,
    clientProxyExitVerified: false,
    originHairpinStatus: "not-tested",
    tunnelBoundaryVerified: false,
    localProcessingVerified: false,
    deliveryHandoffVerified: false,
    browserSaveMode: null,
    browserSaveVerified: false,
    browserStateRequired: false,
    requiresProviderPage: false,
    sourceIpBound: false,
    temporaryFailure: false,
    failures: ["tunnel_boundary_unverified", "delivery_handoff_unverified", "browser_save_unverified"]
  },
  {
    providerId: "cobalt-selfhosted",
    platform: "reddit",
    runtimeProbePassed: true,
    runtimeServiceAdvertised: true,
    apiKeyAllowed: true,
    serviceDisabled: false,
    samplesAttempted: 2,
    samplesResolved: 0,
    responseModes: ["error", "error"],
    deliveryTopology: "direct-source",
    mediaHostPolicyVerified: false,
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
    browserStateRequired: true,
    requiresProviderPage: false,
    sourceIpBound: false,
    temporaryFailure: false,
    failures: ["browser_state_required"]
  },
  {
    providerId: "cobalt-selfhosted",
    platform: "vk",
    runtimeProbePassed: true,
    runtimeServiceAdvertised: true,
    apiKeyAllowed: true,
    serviceDisabled: false,
    samplesAttempted: 2,
    samplesResolved: 0,
    responseModes: ["error", "error"],
    deliveryTopology: "direct-source",
    mediaHostPolicyVerified: false,
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
    browserStateRequired: true,
    requiresProviderPage: false,
    sourceIpBound: false,
    temporaryFailure: false,
    failures: ["browser_state_required"]
  }
];

export function assessCurrentCobaltPlannedPlatformQualification(): readonly CobaltPlatformQualificationAssessment[] {
  return COBALT_PLANNED_PLATFORM_QUALIFICATION_EVIDENCE.map(assessCobaltPlatformQualification);
}
