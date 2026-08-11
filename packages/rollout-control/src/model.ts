import {
  PlatformIdSchema,
  ProviderKindSchema,
  ProviderRegionSchema,
  RegionIdSchema
} from "@tikdd/contracts";
import { z } from "zod";

export const RolloutRuleIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

export const RolloutProviderIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

export const RolloutProviderSelectorSchema = z.union([
  RolloutProviderIdSchema,
  z.literal("*")
]);

export const RolloutPlatformSelectorSchema = z.union([PlatformIdSchema, z.literal("*")]);

export const RolloutRuleDraftSchema = z
  .object({
    id: RolloutRuleIdSchema,
    providerId: RolloutProviderSelectorSchema,
    platform: RolloutPlatformSelectorSchema,
    region: ProviderRegionSchema,
    enabled: z.boolean(),
    allocationBps: z.number().int().min(0).max(10_000),
    activatesAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable()
  })
  .superRefine((rule, context) => {
    if (!rule.enabled && rule.allocationBps !== 0) {
      context.addIssue({
        code: "custom",
        message: "A deny rule must have zero allocation.",
        path: ["allocationBps"]
      });
    }
    if (rule.enabled && rule.providerId === "*") {
      context.addIssue({
        code: "custom",
        message: "A fleet-wide rule may deny but cannot grant provider access.",
        path: ["providerId"]
      });
    }
    if (rule.expiresAt && new Date(rule.expiresAt) <= new Date(rule.activatesAt)) {
      context.addIssue({
        code: "custom",
        message: "Rule expiry must be after activation.",
        path: ["expiresAt"]
      });
    }
  });
export type RolloutRuleDraft = z.infer<typeof RolloutRuleDraftSchema>;

export const RolloutOperatorIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9]+(?:[._:@-][a-zA-Z0-9]+)*$/);

export const RolloutChangeReasonSchema = z.string().trim().min(1).max(500);

export const RolloutRuleChangeSchema = z.object({
  rule: RolloutRuleDraftSchema,
  operatorId: RolloutOperatorIdSchema,
  reason: RolloutChangeReasonSchema,
  expectedRevision: z.number().int().positive().nullable()
});
export type RolloutRuleChange = z.infer<typeof RolloutRuleChangeSchema>;

export const RolloutRuleSchema = RolloutRuleDraftSchema.safeExtend({
  revision: z.number().int().positive()
});
export type RolloutRule = z.infer<typeof RolloutRuleSchema>;

function selectorMatches(left: string, right: string): boolean {
  return left === "*" || right === "*" || left === right;
}

function specificity(rule: RolloutRule): number {
  return Number(rule.providerId !== "*") + Number(rule.platform !== "*") + Number(rule.region !== "*");
}

export const RolloutSnapshotSchema = z
  .object({
    schemaVersion: z.literal("1"),
    revision: z.number().int().nonnegative(),
    generatedAt: z.string().datetime(),
    rules: z.array(RolloutRuleSchema).max(10_000)
  })
  .superRefine((snapshot, context) => {
    const ids = new Set<string>();
    const selectors = new Set<string>();
    for (const [index, rule] of snapshot.rules.entries()) {
      if (ids.has(rule.id)) {
        context.addIssue({ code: "custom", message: "Duplicate rollout rule ID.", path: ["rules", index, "id"] });
      }
      ids.add(rule.id);
      const selector = `${rule.providerId}\0${rule.platform}\0${rule.region}`;
      if (selectors.has(selector)) {
        context.addIssue({ code: "custom", message: "Duplicate rollout selector.", path: ["rules", index] });
      }
      selectors.add(selector);
    }

    const grants = snapshot.rules.filter((rule) => rule.enabled);
    for (let leftIndex = 0; leftIndex < grants.length; leftIndex += 1) {
      const left = grants[leftIndex] as RolloutRule;
      for (let rightIndex = leftIndex + 1; rightIndex < grants.length; rightIndex += 1) {
        const right = grants[rightIndex] as RolloutRule;
        if (
          specificity(left) === specificity(right) &&
          selectorMatches(left.providerId, right.providerId) &&
          selectorMatches(left.platform, right.platform) &&
          selectorMatches(left.region, right.region)
        ) {
          context.addIssue({
            code: "custom",
            message: `Ambiguous equally specific grants: ${left.id} and ${right.id}.`,
            path: ["rules"]
          });
        }
      }
    }
  });
export type RolloutSnapshot = z.infer<typeof RolloutSnapshotSchema>;

export const ProviderRolloutRequestSchema = z.object({
  taskId: z.string().regex(/^tsk_[a-f0-9]{32}$/),
  providerId: RolloutProviderIdSchema,
  providerKind: ProviderKindSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema
});
export type ProviderRolloutRequest = z.infer<typeof ProviderRolloutRequestSchema>;

export const RolloutDecisionReasonSchema = z.enum([
  "allowed",
  "matching_deny",
  "outside_allocation",
  "no_matching_rule",
  "stale_snapshot",
  "control_unavailable",
  "production_mock_denied",
  "development_bypass",
  "automatic_guard_denied",
  "outside_guard_allocation",
  "guard_unavailable",
  "stale_guard"
]);
export type RolloutDecisionReason = z.infer<typeof RolloutDecisionReasonSchema>;

export const RolloutDecisionSchema = z.object({
  allowed: z.boolean(),
  reason: RolloutDecisionReasonSchema,
  ruleId: RolloutRuleIdSchema.nullable(),
  snapshotRevision: z.number().int().nonnegative().nullable(),
  bucket: z.number().int().min(0).max(9_999).nullable()
});
export type RolloutDecision = z.infer<typeof RolloutDecisionSchema>;

export interface ProviderRolloutSource {
  decide(request: ProviderRolloutRequest): Promise<RolloutDecision>;
}

export const PilotGuardReasonSchema = z.enum([
  "healthy_hold",
  "insufficient_samples",
  "stale_evidence",
  "absolute_stop",
  "resolution_error",
  "latency",
  "challenge",
  "invalid_result",
  "delivery_error",
  "candidate_coverage",
  "fallback_depth",
  "timeout",
  "expiry",
  "incompatible_evidence"
]);
export type PilotGuardReason = z.infer<typeof PilotGuardReasonSchema>;

export const PilotGuardActionSchema = z.enum([
  "hold",
  "reduce",
  "deny",
  "eligible_for_review"
]);
export type PilotGuardAction = z.infer<typeof PilotGuardActionSchema>;

const BasisPointsSchema = z.number().int().min(0).max(10_000);

export const PilotPolicySchema = z.object({
  id: RolloutRuleIdSchema,
  version: z.number().int().positive(),
  providerId: RolloutProviderIdSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  calibrationStartedAt: z.string().datetime(),
  calibrationCompletedAt: z.string().datetime(),
  lockedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  observationClass: z.enum(["internal", "public"]),
  evaluationDays: z.number().int().min(1).max(7),
  recoveryDays: z.number().int().min(1).max(7),
  cooldownMs: z.number().int().min(60_000).max(30 * 24 * 60 * 60 * 1_000),
  aggregationVersion: z.number().int().positive(),
  taxonomyVersion: z.number().int().positive(),
  calibrationDayRevisions: z.array(z.number().int().positive()).length(3),
  minimumSamples: z.number().int().positive(),
  maximumEvidenceAgeMs: z.number().int().min(60_000).max(7 * 24 * 60 * 60 * 1_000),
  staleAction: z.enum(["reduce", "deny"]),
  rollbackAllocationBps: BasisPointsSchema,
  thresholds: z.object({
    minimumResolutionSuccessBps: BasisPointsSchema,
    maximumP95LatencyMs: z.number().int().positive(),
    maximumChallengeRateBps: BasisPointsSchema,
    maximumTimeoutRateBps: BasisPointsSchema,
    maximumInvalidResultRateBps: BasisPointsSchema,
    minimumDeliverySuccessBps: BasisPointsSchema,
    minimumCandidateCoverageBps: BasisPointsSchema,
    maximumFallbackDepthP95: z.number().int().min(0).max(99),
    maximumExpiryRateBps: BasisPointsSchema
  })
}).superRefine((policy, context) => {
  const calibrationMs = new Date(policy.calibrationCompletedAt).getTime() - new Date(policy.calibrationStartedAt).getTime();
  if (calibrationMs < 3 * 24 * 60 * 60 * 1_000) {
    context.addIssue({ code: "custom", message: "A locked pilot policy requires three complete calibration days.", path: ["calibrationCompletedAt"] });
  }
  if (new Date(policy.lockedAt) < new Date(policy.calibrationCompletedAt)) {
    context.addIssue({ code: "custom", message: "Policy lock time cannot precede calibration completion.", path: ["lockedAt"] });
  }
  if (new Date(policy.expiresAt) <= new Date(policy.lockedAt)) {
    context.addIssue({ code: "custom", message: "Pilot policy expiry must follow its lock time.", path: ["expiresAt"] });
  }
});
export type PilotPolicy = z.infer<typeof PilotPolicySchema>;

export const PilotEvidenceSchema = z.object({
  providerId: RolloutProviderIdSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  observationClass: z.enum(["internal", "public"]),
  aggregationVersion: z.number().int().positive(),
  taxonomyVersion: z.number().int().positive(),
  dayRevisions: z.array(z.number().int().positive()).min(1).max(7),
  completeDays: z.number().int().min(1).max(7),
  sealedDays: z.number().int().min(0).max(7),
  windowStartedAt: z.string().datetime(),
  windowEndedAt: z.string().datetime(),
  collectedAt: z.string().datetime(),
  distinctSamples: z.number().int().nonnegative(),
  resolutionSuccessBps: BasisPointsSchema,
  p95LatencyMs: z.number().int().nonnegative(),
  challengeRateBps: BasisPointsSchema,
  timeoutRateBps: BasisPointsSchema,
  invalidResultRateBps: BasisPointsSchema,
  deliverySuccessBps: BasisPointsSchema,
  candidateCoverageBps: BasisPointsSchema,
  fallbackDepthP95: z.number().int().min(0).max(99),
  expiryRateBps: BasisPointsSchema,
  absoluteStop: z.boolean()
}).superRefine((evidence, context) => {
  if (new Date(evidence.windowEndedAt) <= new Date(evidence.windowStartedAt)) {
    context.addIssue({ code: "custom", message: "Evidence window must end after it starts.", path: ["windowEndedAt"] });
  }
  if (evidence.dayRevisions.length !== evidence.completeDays) {
    context.addIssue({ code: "custom", message: "Every complete evidence day requires one revision.", path: ["dayRevisions"] });
  }
  if (evidence.sealedDays > evidence.completeDays) {
    context.addIssue({ code: "custom", message: "Sealed evidence days cannot exceed complete days.", path: ["sealedDays"] });
  }
});
export type PilotEvidence = z.infer<typeof PilotEvidenceSchema>;

export const PilotGuardSchema = z.object({
  providerId: RolloutProviderIdSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  policyId: RolloutRuleIdSchema,
  policyVersion: z.number().int().positive(),
  capBps: BasisPointsSchema,
  lastHealthyAllocationBps: BasisPointsSchema,
  action: PilotGuardActionSchema,
  reason: PilotGuardReasonSchema,
  evidenceWindowStartedAt: z.string().datetime(),
  evidenceWindowEndedAt: z.string().datetime(),
  revision: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime()
});
export type PilotGuard = z.infer<typeof PilotGuardSchema>;

export const PilotGuardSnapshotSchema = z.object({
  schemaVersion: z.literal("1"),
  revision: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
  guards: z.array(PilotGuardSchema).max(10_000)
}).superRefine((snapshot, context) => {
  const tuples = new Set<string>();
  snapshot.guards.forEach((guard, index) => {
    const tuple = `${guard.providerId}\0${guard.platform}\0${guard.region}`;
    if (tuples.has(tuple)) context.addIssue({ code: "custom", message: "Duplicate pilot guard tuple.", path: ["guards", index] });
    tuples.add(tuple);
  });
});
export type PilotGuardSnapshot = z.infer<typeof PilotGuardSnapshotSchema>;

export const PilotGuardSampleSummarySchema = z.object({
  distinctSamples: z.number().int().nonnegative(),
  resolutionSuccessBps: BasisPointsSchema,
  p95LatencyMs: z.number().int().nonnegative(),
  challengeRateBps: BasisPointsSchema,
  timeoutRateBps: BasisPointsSchema,
  invalidResultRateBps: BasisPointsSchema,
  deliverySuccessBps: BasisPointsSchema,
  candidateCoverageBps: BasisPointsSchema,
  fallbackDepthP95: z.number().int().min(0).max(99),
  expiryRateBps: BasisPointsSchema,
  observationClass: z.enum(["internal", "public"]),
  aggregationVersion: z.number().int().positive(),
  taxonomyVersion: z.number().int().positive(),
  dayRevisions: z.array(z.number().int().positive()).min(1).max(7)
});
export type PilotGuardSampleSummary = z.infer<typeof PilotGuardSampleSummarySchema>;
