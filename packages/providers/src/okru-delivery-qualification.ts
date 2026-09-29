import { z } from "zod";

export const OkruDeliveryFailureSchema = z.enum([
  "no_reproducible_endpoint",
  "no_media",
  "invalid_media_descriptor",
  "source_ip_bound",
  "provider_post_only",
  "provider_page_handoff",
  "insufficient_samples",
  "range_unverified",
  "cross_exit_unverified"
]);

export type OkruDeliveryFailure = z.infer<typeof OkruDeliveryFailureSchema>;

export const OkruProviderEvidenceSchema = z.strictObject({
  providerId: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
  endpointPath: z.string().min(1).max(160).nullable(),
  samplesAttempted: z.number().int().min(0).max(10),
  samplesResolved: z.number().int().min(0).max(10),
  mediaRangeVerified: z.boolean(),
  crossExitVerified: z.boolean(),
  browserGetEligible: z.boolean(),
  requiresProviderPost: z.boolean(),
  requiresProviderPage: z.boolean(),
  sourceIpBound: z.boolean(),
  failures: z.array(OkruDeliveryFailureSchema).max(10)
});

export type OkruProviderEvidence = z.infer<typeof OkruProviderEvidenceSchema>;

export const OkruDeliveryAssessmentSchema = z.strictObject({
  providerId: OkruProviderEvidenceSchema.shape.providerId,
  status: z.enum(["qualified", "deferred", "blocked"]),
  adapterEligible: z.boolean(),
  productionRouteEligible: z.boolean(),
  failures: z.array(OkruDeliveryFailureSchema).max(10)
});

export type OkruDeliveryAssessment = z.infer<typeof OkruDeliveryAssessmentSchema>;

export function assessOkruDeliveryEvidence(input: OkruProviderEvidence): OkruDeliveryAssessment {
  const evidence = OkruProviderEvidenceSchema.parse(input);
  const hardBlocked = evidence.sourceIpBound || evidence.requiresProviderPage;
  const qualified =
    evidence.samplesResolved >= 2 &&
    evidence.mediaRangeVerified &&
    evidence.crossExitVerified &&
    evidence.browserGetEligible &&
    !evidence.requiresProviderPost &&
    !hardBlocked &&
    evidence.failures.length === 0;

  return OkruDeliveryAssessmentSchema.parse({
    providerId: evidence.providerId,
    status: qualified ? "qualified" : hardBlocked ? "blocked" : "deferred",
    adapterEligible: qualified,
    productionRouteEligible: qualified,
    failures: evidence.failures
  });
}

/**
 * Sanitized Work Item 118 evidence. It intentionally excludes source URLs, response bodies,
 * cookies, nonces, signed media URLs, query values, and full CDN hosts.
 */
export const OKRU_DELIVERY_POC_EVIDENCE: readonly OkruProviderEvidence[] = [
  {
    providerId: "tryunsora-okru",
    endpointPath: null,
    samplesAttempted: 0,
    samplesResolved: 0,
    mediaRangeVerified: false,
    crossExitVerified: false,
    browserGetEligible: false,
    requiresProviderPost: false,
    requiresProviderPage: false,
    sourceIpBound: false,
    failures: ["no_reproducible_endpoint", "insufficient_samples", "range_unverified", "cross_exit_unverified"]
  },
  {
    providerId: "mediapuller-okru",
    endpointPath: "/",
    samplesAttempted: 1,
    samplesResolved: 1,
    mediaRangeVerified: false,
    crossExitVerified: false,
    browserGetEligible: true,
    requiresProviderPost: false,
    requiresProviderPage: false,
    sourceIpBound: true,
    failures: ["source_ip_bound", "insufficient_samples", "range_unverified", "cross_exit_unverified"]
  },
  {
    providerId: "get-from-okru",
    endpointPath: null,
    samplesAttempted: 0,
    samplesResolved: 0,
    mediaRangeVerified: false,
    crossExitVerified: false,
    browserGetEligible: false,
    requiresProviderPost: false,
    requiresProviderPage: false,
    sourceIpBound: false,
    failures: ["no_reproducible_endpoint", "insufficient_samples", "range_unverified", "cross_exit_unverified"]
  },
  {
    providerId: "a2z-okru",
    endpointPath: "/api/fetch-video-info",
    samplesAttempted: 1,
    samplesResolved: 0,
    mediaRangeVerified: false,
    crossExitVerified: false,
    browserGetEligible: false,
    requiresProviderPost: false,
    requiresProviderPage: false,
    sourceIpBound: false,
    failures: ["no_media", "insufficient_samples", "range_unverified", "cross_exit_unverified"]
  },
  {
    providerId: "toolsphare-okru",
    endpointPath: "/downloader-api/info",
    samplesAttempted: 1,
    samplesResolved: 0,
    mediaRangeVerified: false,
    crossExitVerified: false,
    browserGetEligible: false,
    requiresProviderPost: true,
    requiresProviderPage: false,
    sourceIpBound: false,
    failures: ["invalid_media_descriptor", "provider_post_only", "range_unverified", "cross_exit_unverified"]
  },
  {
    providerId: "saveclips-okru",
    endpointPath: "/wp-json/visolix/api/download",
    samplesAttempted: 1,
    samplesResolved: 0,
    mediaRangeVerified: false,
    crossExitVerified: false,
    browserGetEligible: false,
    requiresProviderPost: false,
    requiresProviderPage: false,
    sourceIpBound: false,
    failures: ["no_media", "range_unverified", "cross_exit_unverified"]
  },
  {
    providerId: "okgrabber",
    endpointPath: "/wp-admin/admin-ajax.php",
    samplesAttempted: 2,
    samplesResolved: 2,
    mediaRangeVerified: true,
    crossExitVerified: false,
    browserGetEligible: false,
    requiresProviderPost: false,
    requiresProviderPage: true,
    sourceIpBound: true,
    failures: ["source_ip_bound", "provider_page_handoff", "cross_exit_unverified"]
  },
  {
    providerId: "sparkdownloader-okru",
    endpointPath: null,
    samplesAttempted: 0,
    samplesResolved: 0,
    mediaRangeVerified: false,
    crossExitVerified: false,
    browserGetEligible: false,
    requiresProviderPost: false,
    requiresProviderPage: false,
    sourceIpBound: false,
    failures: ["no_reproducible_endpoint", "insufficient_samples", "range_unverified", "cross_exit_unverified"]
  }
] as const;

export function assessOkruDeliveryPortfolio(): readonly OkruDeliveryAssessment[] {
  return OKRU_DELIVERY_POC_EVIDENCE.map((evidence) => assessOkruDeliveryEvidence(evidence));
}
