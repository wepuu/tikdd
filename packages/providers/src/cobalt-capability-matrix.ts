import { PlatformSchema, type Platform } from "@tikdd/contracts";
import { z } from "zod";

/**
 * Sanitized capability evidence for a self-hosted Cobalt service.
 *
 * This model intentionally contains only platform IDs, response modes and boolean delivery
 * gates. It must never be used to persist source URLs, media URLs, signed query values or
 * credentials.
 */
export const CobaltCapabilityResponseModeSchema = z.enum([
  "redirect",
  "picker",
  "tunnel",
  "local-processing",
  "error"
]);
export type CobaltCapabilityResponseMode = z.infer<typeof CobaltCapabilityResponseModeSchema>;

export const CobaltCapabilityFailureSchema = z.enum([
  "runtime_not_verified",
  "service_not_advertised",
  "service_disabled",
  "api_key_not_allowed",
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
export type CobaltCapabilityFailure = z.infer<typeof CobaltCapabilityFailureSchema>;

export const CobaltCapabilityStatusSchema = z.enum([
  "qualified-secondary",
  "resolved-candidate",
  "resolved-conditional",
  "proxy-only",
  "delivery-blocked",
  "no-media",
  "blocked",
  "deferred"
]);
export type CobaltCapabilityStatus = z.infer<typeof CobaltCapabilityStatusSchema>;

export const CobaltPlatformQualificationEvidenceSchema = z.strictObject({
  providerId: z.literal("cobalt-selfhosted"),
  platform: PlatformSchema,
  runtimeProbePassed: z.boolean(),
  runtimeServiceAdvertised: z.boolean(),
  apiKeyAllowed: z.boolean(),
  serviceDisabled: z.boolean(),
  samplesAttempted: z.number().int().min(0).max(2),
  samplesResolved: z.number().int().min(0).max(2),
  responseModes: z.array(CobaltCapabilityResponseModeSchema).max(2),
  mediaHostPolicyVerified: z.boolean(),
  mediaRangeVerified: z.boolean(),
  crossExitVerified: z.boolean(),
  browserSaveMode: z.enum(["attachment", "cors-download"]).nullable(),
  browserStateRequired: z.boolean(),
  requiresProviderPage: z.boolean(),
  sourceIpBound: z.boolean(),
  temporaryFailure: z.boolean(),
  failures: z.array(CobaltCapabilityFailureSchema).max(16)
});
export type CobaltPlatformQualificationEvidence = z.infer<
  typeof CobaltPlatformQualificationEvidenceSchema
>;

export const CobaltPlatformQualificationAssessmentSchema = z.strictObject({
  providerId: CobaltPlatformQualificationEvidenceSchema.shape.providerId,
  platform: CobaltPlatformQualificationEvidenceSchema.shape.platform,
  status: CobaltCapabilityStatusSchema,
  adapterEligible: z.boolean(),
  productionRouteEligible: z.boolean(),
  failures: z.array(CobaltCapabilityFailureSchema).max(16)
});
export type CobaltPlatformQualificationAssessment = z.infer<
  typeof CobaltPlatformQualificationAssessmentSchema
>;

const BLOCKING_DELIVERY_FAILURES = new Set<CobaltCapabilityFailure>([
  "unsafe_media_host",
  "range_unverified",
  "cross_exit_unverified",
  "browser_save_unverified",
  "browser_state_required",
  "provider_page_handoff",
  "source_ip_bound"
]);

const NO_MEDIA_FAILURES = new Set<CobaltCapabilityFailure>([
  "provider_error_envelope",
  "invalid_cobalt_status",
  "non_portable_result",
  "no_media"
]);

const SERVICE_ALIASES: Record<string, Platform> = {
  ok: "odnoklassniki",
  odnoklassniki: "odnoklassniki",
  twitter: "x",
  x: "x",
  instagram: "instagram",
  tiktok: "tiktok",
  facebook: "facebook",
  pinterest: "pinterest",
  vimeo: "vimeo",
  dailymotion: "dailymotion",
  reddit: "reddit",
  soundcloud: "soundcloud",
  vk: "vk",
  xiaohongshu: "xiaohongshu",
  snapchat: "snapchat",
  loom: "loom"
};

/**
 * Reads the documented GET / shape. The probe deliberately ignores top-level or guessed service
 * fields so a future response shape cannot silently expand the approved platform set.
 */
export function parseCobaltRuntimeServices(body: unknown): string[] {
  if (typeof body !== "object" || body === null || !("cobalt" in body)) return [];
  const cobalt = (body as { cobalt?: unknown }).cobalt;
  if (typeof cobalt !== "object" || cobalt === null || !("services" in cobalt)) return [];
  const services = (cobalt as { services?: unknown }).services;
  if (!Array.isArray(services)) return [];
  return services
    .map((service) => {
      if (typeof service === "string") return service;
      if (typeof service !== "object" || service === null) return null;
      const value = service as { id?: unknown; name?: unknown };
      return typeof value.id === "string"
        ? value.id
        : typeof value.name === "string"
          ? value.name
          : null;
    })
    .map((service) => service?.trim().toLowerCase() ?? "")
    .filter((service, index, values) => /^[a-z0-9_-]{1,64}$/.test(service) && values.indexOf(service) === index);
}

/** Maps only reviewed service identifiers to TikDD platform slugs. */
export function mapCobaltRuntimeServicesToPlatforms(services: readonly string[]): Platform[] {
  const platforms: Platform[] = [];
  for (const service of services) {
    const platform = SERVICE_ALIASES[service.trim().toLowerCase()];
    if (!platform || platforms.includes(platform)) continue;
    platforms.push(platform);
  }
  return platforms;
}

export function assessCobaltPlatformQualification(
  input: CobaltPlatformQualificationEvidence
): CobaltPlatformQualificationAssessment {
  const evidence = CobaltPlatformQualificationEvidenceSchema.parse(input);
  const qualified =
    evidence.runtimeProbePassed &&
    evidence.runtimeServiceAdvertised &&
    evidence.apiKeyAllowed &&
    !evidence.serviceDisabled &&
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

  let status: CobaltCapabilityStatus;
  if (qualified) {
    status = "qualified-secondary";
  } else if (evidence.responseModes.some((mode) => mode === "tunnel" || mode === "local-processing")) {
    status = "proxy-only";
  } else if (evidence.browserStateRequired) {
    status = "blocked";
  } else if (evidence.sourceIpBound || evidence.requiresProviderPage || evidence.failures.some((failure) => BLOCKING_DELIVERY_FAILURES.has(failure))) {
    status = "delivery-blocked";
  } else if (evidence.failures.some((failure) => NO_MEDIA_FAILURES.has(failure))) {
    status = "no-media";
  } else if (!evidence.runtimeProbePassed || evidence.temporaryFailure || evidence.failures.includes("temporary_failure")) {
    status = "deferred";
  } else if (evidence.samplesResolved > 0 && evidence.samplesAttempted < 2) {
    status = "resolved-candidate";
  } else if (evidence.samplesResolved > 0) {
    status = "resolved-conditional";
  } else {
    status = "deferred";
  }

  return CobaltPlatformQualificationAssessmentSchema.parse({
    providerId: evidence.providerId,
    platform: evidence.platform,
    status,
    adapterEligible: qualified,
    productionRouteEligible: qualified,
    failures: evidence.failures
  });
}
