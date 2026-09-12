import { PlatformIdSchema } from "@tikdd/contracts";
import { z } from "zod";

const ProviderIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

/**
 * Small, code-owned intake record for a future free Provider.
 *
 * This is intentionally not a persistence or Admin command contract. It is a deterministic
 * pre-flight shape that keeps an unreviewed candidate out of manifests and rollout rules.
 */
export const FreeProviderCandidateSchema = z.strictObject({
  id: ProviderIdSchema,
  displayName: z.string().min(1).max(100),
  platforms: z.array(PlatformIdSchema).min(1).max(32),
  freeAccess: z.boolean(),
  publicContentOnly: z.boolean(),
  requiresLogin: z.boolean(),
  requiresCookies: z.boolean(),
  requiresInteractiveChallenge: z.boolean(),
  requiresPaidApi: z.boolean(),
  manifestReviewed: z.boolean(),
  hostPolicyReviewed: z.boolean(),
  deliveryMode: z.enum(["redirect", "resolution-only"]),
  deliveryVerified: z.boolean(),
  successFixtureCount: z.number().int().min(0).max(100),
  failureFixtureCount: z.number().int().min(0).max(100),
  evidenceState: z.enum(["not-evaluated", "evaluating", "qualified", "rejected"])
});

export type FreeProviderCandidate = z.infer<typeof FreeProviderCandidateSchema>;

export const FreeProviderQualificationReasonSchema = z.enum([
  "not_free",
  "public_only_boundary",
  "login_required",
  "cookies_required",
  "interactive_challenge",
  "paid_api_required",
  "manifest_unreviewed",
  "host_policy_unreviewed",
  "missing_success_fixture",
  "missing_failure_fixtures",
  "delivery_unverified",
  "not_evaluated"
]);

export type FreeProviderQualificationReason = z.infer<
  typeof FreeProviderQualificationReasonSchema
>;

export const FreeProviderQualificationStatusSchema = z.enum([
  "accepted",
  "deferred",
  "rejected"
]);

export type FreeProviderQualificationStatus = z.infer<
  typeof FreeProviderQualificationStatusSchema
>;

export const FreeProviderQualificationResultSchema = z.strictObject({
  providerId: ProviderIdSchema,
  status: FreeProviderQualificationStatusSchema,
  eligibleForImplementation: z.boolean(),
  productionRouteEligible: z.boolean(),
  reasons: z.array(FreeProviderQualificationReasonSchema).max(12)
});

export type FreeProviderQualificationResult = z.infer<
  typeof FreeProviderQualificationResultSchema
>;

/** The minimum negative-fixture coverage needed before a candidate can be implemented. */
export const FREE_PROVIDER_MIN_FAILURE_FIXTURES = 4;

/**
 * Classify a candidate without network access. Hard policy failures reject immediately; missing
 * review evidence defers the candidate. This function never promotes a candidate by itself.
 */
export function qualifyFreeProviderCandidate(
  input: FreeProviderCandidate
): FreeProviderQualificationResult {
  const candidate = FreeProviderCandidateSchema.parse(input);
  const hardFailures: FreeProviderQualificationReason[] = [];
  const pending: FreeProviderQualificationReason[] = [];

  if (!candidate.freeAccess) hardFailures.push("not_free");
  if (!candidate.publicContentOnly) hardFailures.push("public_only_boundary");
  if (candidate.requiresLogin) hardFailures.push("login_required");
  if (candidate.requiresCookies) hardFailures.push("cookies_required");
  if (candidate.requiresInteractiveChallenge) hardFailures.push("interactive_challenge");
  if (candidate.requiresPaidApi) hardFailures.push("paid_api_required");

  if (!candidate.manifestReviewed) pending.push("manifest_unreviewed");
  if (!candidate.hostPolicyReviewed) pending.push("host_policy_unreviewed");
  if (candidate.successFixtureCount < 1) pending.push("missing_success_fixture");
  if (candidate.failureFixtureCount < FREE_PROVIDER_MIN_FAILURE_FIXTURES) {
    pending.push("missing_failure_fixtures");
  }
  if (candidate.deliveryMode === "redirect" && !candidate.deliveryVerified) {
    pending.push("delivery_unverified");
  }
  if (candidate.evidenceState !== "qualified") pending.push("not_evaluated");

  const reasons = [...hardFailures, ...pending];
  const status: FreeProviderQualificationStatus = hardFailures.length > 0
    ? "rejected"
    : pending.length > 0
      ? "deferred"
      : "accepted";

  return FreeProviderQualificationResultSchema.parse({
    providerId: candidate.id,
    status,
    eligibleForImplementation: status === "accepted",
    productionRouteEligible: status === "accepted" && candidate.deliveryMode === "redirect",
    reasons
  });
}
