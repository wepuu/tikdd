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
  "development_bypass"
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
