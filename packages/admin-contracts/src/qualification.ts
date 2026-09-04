import { PlatformIdSchema, RegionIdSchema } from "@tikdd/contracts";
import { z } from "zod";
import {
  AdminActorSubjectSchema,
  AdminProviderIdSchema,
  AdminReasonSchema,
  AdminRevisionSchema,
  AdminSchemaVersionSchema,
  AdminTimestampSchema,
  RouteTupleSchema
} from "./common";

export const AdminQualificationStageSchema = z.enum([
  "candidate", "fixture-ready", "canary-ready", "internal", "limited", "stable"
]);

const RateBpsSchema = z.number().int().min(0).max(10_000);
const IdempotencyKeySchema = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);
const confirmation = (providerId: string, platform: string, region: string) =>
  `${providerId}/${platform}/${region}`;

export const AdminQualificationPolicySchema = z.strictObject({
  id: z.string().min(1).max(64).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
  version: AdminRevisionSchema,
  providerId: AdminProviderIdSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  calibrationStartedAt: AdminTimestampSchema,
  calibrationCompletedAt: AdminTimestampSchema,
  lockedAt: AdminTimestampSchema,
  expiresAt: AdminTimestampSchema,
  observationClass: z.enum(["internal", "public"]),
  evaluationDays: z.number().int().min(1).max(7),
  recoveryDays: z.number().int().min(1).max(7),
  cooldownMs: z.number().int().min(60_000).max(30 * 24 * 60 * 60 * 1_000),
  aggregationVersion: AdminRevisionSchema,
  taxonomyVersion: AdminRevisionSchema,
  calibrationDayRevisions: z.array(AdminRevisionSchema).length(3),
  minimumSamples: z.number().int().positive(),
  maximumEvidenceAgeMs: z.number().int().min(60_000).max(7 * 24 * 60 * 60 * 1_000),
  staleAction: z.enum(["reduce", "deny"]),
  rollbackAllocationBps: RateBpsSchema,
  thresholds: z.strictObject({
    minimumResolutionSuccessBps: RateBpsSchema,
    maximumP95LatencyMs: z.number().int().positive(),
    maximumChallengeRateBps: RateBpsSchema,
    maximumTimeoutRateBps: RateBpsSchema,
    maximumInvalidResultRateBps: RateBpsSchema,
    minimumDeliverySuccessBps: RateBpsSchema,
    minimumCandidateCoverageBps: RateBpsSchema,
    maximumFallbackDepthP95: z.number().int().min(0).max(99),
    maximumExpiryRateBps: RateBpsSchema
  })
});

export const AdminQualificationViewSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  generatedAt: AdminTimestampSchema,
  tuple: RouteTupleSchema,
  state: z.strictObject({
    stage: AdminQualificationStageSchema,
    paused: z.boolean(),
    pauseReason: AdminReasonSchema.nullable(),
    approvalReference: z.string().trim().min(1).max(160).nullable(),
    policyId: z.string().min(1).max(64).nullable(),
    policyVersion: AdminRevisionSchema.nullable(),
    reviewer: AdminActorSubjectSchema.nullable(),
    revision: AdminRevisionSchema.nullable(),
    reviewedAt: AdminTimestampSchema.nullable()
  }),
  prerequisites: z.array(z.strictObject({
    code: z.enum(["manifest_declared", "manifest_enabled", "region_supported", "fixture_verified", "delivery_supported", "canary_ready", "calibration_complete", "policy_locked"]),
    satisfied: z.boolean(),
    detail: z.string().min(1).max(240)
  })).length(8),
  calibration: z.strictObject({
    requiredDays: z.literal(3),
    complete: z.boolean(),
    windowStartedAt: AdminTimestampSchema.nullable(),
    windowEndedAt: AdminTimestampSchema.nullable(),
    days: z.array(z.strictObject({
      utcDay: z.string().date(),
      completeness: z.enum(["open", "complete", "sealed"]),
      revision: AdminRevisionSchema,
      distinctSamples: z.number().int().nonnegative(),
      resolutionSuccessBps: RateBpsSchema,
      deliverySuccessBps: RateBpsSchema,
      p95LatencyMs: z.number().int().nonnegative()
    })).max(3)
  }),
  proposal: z.strictObject({
    proposalId: z.string().uuid(),
    status: z.enum(["proposed", "locked", "rejected", "superseded"]),
    revision: AdminRevisionSchema,
    evidenceOwner: AdminActorSubjectSchema,
    dayRevisions: z.array(AdminRevisionSchema).length(3),
    policy: AdminQualificationPolicySchema,
    createdAt: AdminTimestampSchema,
    updatedAt: AdminTimestampSchema
  }).nullable(),
  lockedPolicy: AdminQualificationPolicySchema.nullable(),
  guard: z.strictObject({
    action: z.enum(["hold", "reduce", "deny", "eligible_for_review"]),
    reason: z.enum(["healthy_hold", "insufficient_samples", "stale_evidence", "absolute_stop", "resolution_error", "latency", "challenge", "invalid_result", "delivery_error", "candidate_coverage", "fallback_depth", "timeout", "expiry", "incompatible_evidence"]),
    capBps: RateBpsSchema,
    revision: AdminRevisionSchema,
    updatedAt: AdminTimestampSchema,
    expiresAt: AdminTimestampSchema
  }).nullable(),
  rollout: z.strictObject({ allocationBps: RateBpsSchema, revision: AdminRevisionSchema.nullable() }),
  eligibility: z.strictObject({
    decisions: z.array(z.enum(["approve", "hold", "deny"])).min(2).max(3),
    promotionEligible: z.boolean(),
    blockers: z.array(z.string().min(1).max(240)).max(16),
    effectiveAllocationCapBps: RateBpsSchema
  })
});

const CommandBaseSchema = z.strictObject({
  providerId: AdminProviderIdSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  expectedRevision: AdminRevisionSchema.nullable(),
  reason: AdminReasonSchema,
  confirmation: z.string().min(5).max(240),
  idempotencyKey: IdempotencyKeySchema
});

export const AdminQualificationReviewCommandSchema = CommandBaseSchema.extend({
  decision: z.enum(["approve", "hold", "deny"]),
  targetStage: AdminQualificationStageSchema,
  approvalReference: z.string().trim().min(1).max(160).nullable()
}).superRefine((command, context) => {
  if (command.confirmation !== confirmation(command.providerId, command.platform, command.region)) {
    context.addIssue({ code: "custom", message: "Qualification confirmation does not match the exact route.", path: ["confirmation"] });
  }
  if (command.decision === "approve" && !command.approvalReference) {
    context.addIssue({ code: "custom", message: "Approval requires a bounded approval reference.", path: ["approvalReference"] });
  }
});

export const AdminQualificationLockCommandSchema = CommandBaseSchema.extend({
  proposalId: z.string().uuid(),
  expectedProposalRevision: AdminRevisionSchema
}).superRefine((command, context) => {
  if (command.confirmation !== confirmation(command.providerId, command.platform, command.region)) {
    context.addIssue({ code: "custom", message: "Qualification confirmation does not match the exact route.", path: ["confirmation"] });
  }
});

export type AdminQualificationView = z.infer<typeof AdminQualificationViewSchema>;
export type AdminQualificationStage = z.infer<typeof AdminQualificationStageSchema>;
export type AdminQualificationReviewCommand = z.infer<typeof AdminQualificationReviewCommandSchema>;
export type AdminQualificationLockCommand = z.infer<typeof AdminQualificationLockCommandSchema>;
export type AdminQualificationPolicy = z.infer<typeof AdminQualificationPolicySchema>;
