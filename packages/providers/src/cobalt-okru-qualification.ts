import { z } from "zod";

/**
 * Sanitized, code-owned evidence for the first self-hosted Cobalt platform canary.
 *
 * This record deliberately contains no source URLs, media URLs, response bodies, signed query
 * values, cookies, tokens, or complete CDN hostnames. It is not a persistence or Admin contract.
 */
export const CobaltOkruQualificationFailureSchema = z.enum([
  "insufficient_samples",
  "runtime_not_verified",
  "provider_error_envelope",
  "invalid_cobalt_status",
  "non_portable_result",
  "no_media",
  "unsafe_media_host",
  "range_unverified",
  "cross_exit_unverified",
  "browser_save_unverified",
  "browser_state_required",
  "provider_page_handoff",
  "source_ip_bound",
  "temporary_failure"
]);

export type CobaltOkruQualificationFailure = z.infer<typeof CobaltOkruQualificationFailureSchema>;

export const CobaltOkruQualificationStatusSchema = z.enum([
  "qualified",
  "resolved-conditional",
  "delivery-blocked",
  "no-media",
  "blocked",
  "deferred"
]);

export type CobaltOkruQualificationStatus = z.infer<typeof CobaltOkruQualificationStatusSchema>;

export const CobaltOkruQualificationEvidenceSchema = z.strictObject({
  providerId: z.literal("cobalt-selfhosted"),
  platform: z.literal("odnoklassniki"),
  runtimeProbePassed: z.boolean(),
  samplesAttempted: z.number().int().min(0).max(2),
  samplesResolved: z.number().int().min(0).max(2),
  mediaHostPolicyVerified: z.boolean(),
  mediaRangeVerified: z.boolean(),
  crossExitVerified: z.boolean(),
  browserSaveMode: z.enum(["attachment", "cors-download"]).nullable(),
  browserStateRequired: z.boolean(),
  requiresProviderPage: z.boolean(),
  sourceIpBound: z.boolean(),
  temporaryFailure: z.boolean(),
  failures: z.array(CobaltOkruQualificationFailureSchema).max(12)
});

export type CobaltOkruQualificationEvidence = z.infer<typeof CobaltOkruQualificationEvidenceSchema>;

export const CobaltOkruQualificationAssessmentSchema = z.strictObject({
  providerId: CobaltOkruQualificationEvidenceSchema.shape.providerId,
  platform: CobaltOkruQualificationEvidenceSchema.shape.platform,
  status: CobaltOkruQualificationStatusSchema,
  adapterEligible: z.boolean(),
  productionRouteEligible: z.boolean(),
  failures: z.array(CobaltOkruQualificationFailureSchema).max(12)
});

export type CobaltOkruQualificationAssessment = z.infer<typeof CobaltOkruQualificationAssessmentSchema>;

export function assessCobaltOkruQualification(
  input: CobaltOkruQualificationEvidence
): CobaltOkruQualificationAssessment {
  const evidence = CobaltOkruQualificationEvidenceSchema.parse(input);
  const qualified =
    evidence.runtimeProbePassed &&
    evidence.samplesAttempted === 2 &&
    evidence.samplesResolved === 2 &&
    evidence.mediaHostPolicyVerified &&
    evidence.mediaRangeVerified &&
    evidence.crossExitVerified &&
    evidence.browserSaveMode !== null &&
    !evidence.browserStateRequired &&
    !evidence.requiresProviderPage &&
    !evidence.sourceIpBound &&
    !evidence.temporaryFailure &&
    evidence.failures.length === 0;

  let status: CobaltOkruQualificationStatus;
  if (qualified) {
    status = "qualified";
  } else if (evidence.browserStateRequired) {
    status = "blocked";
  } else if (evidence.sourceIpBound || evidence.requiresProviderPage) {
    status = "delivery-blocked";
  } else if (evidence.failures.some((failure) =>
    ["provider_error_envelope", "invalid_cobalt_status", "non_portable_result", "no_media", "unsafe_media_host"].includes(failure)
  )) {
    status = "no-media";
  } else if (!evidence.runtimeProbePassed || evidence.temporaryFailure || evidence.failures.includes("temporary_failure")) {
    status = "deferred";
  } else if (evidence.samplesResolved > 0) {
    status = "resolved-conditional";
  } else {
    status = "deferred";
  }

  return CobaltOkruQualificationAssessmentSchema.parse({
    providerId: evidence.providerId,
    platform: evidence.platform,
    status,
    adapterEligible: qualified,
    productionRouteEligible: qualified,
    failures: evidence.failures
  });
}

/**
 * Closed-gate production evidence. The private Cobalt runtime passed authentication and advertised
 * the OK service, but the first native sample returned a Cobalt error response with no media.
 * The fail-fast boundary stopped the second sample and no platform route was activated.
 */
export const COBALT_OKRU_QUALIFICATION_EVIDENCE: CobaltOkruQualificationEvidence = {
  providerId: "cobalt-selfhosted",
  platform: "odnoklassniki",
  runtimeProbePassed: true,
  samplesAttempted: 1,
  samplesResolved: 0,
  mediaHostPolicyVerified: false,
  mediaRangeVerified: false,
  crossExitVerified: false,
  browserSaveMode: null,
  browserStateRequired: false,
  requiresProviderPage: false,
  sourceIpBound: false,
  temporaryFailure: false,
  failures: [
    "provider_error_envelope",
    "insufficient_samples",
    "range_unverified",
    "cross_exit_unverified",
    "browser_save_unverified"
  ]
};

export function assessCurrentCobaltOkruQualification(): CobaltOkruQualificationAssessment {
  return assessCobaltOkruQualification(COBALT_OKRU_QUALIFICATION_EVIDENCE);
}
