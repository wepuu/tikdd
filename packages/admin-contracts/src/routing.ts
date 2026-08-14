import {
  PlatformIdSchema,
  ProviderManifestSchema,
  RegionIdSchema,
  type ProviderManifest
} from "@tikdd/contracts";
import { z } from "zod";
import {
  AdminActorSubjectSchema,
  AdminPropagationStateSchema,
  AdminProviderIdSchema,
  AdminReasonSchema,
  AdminRevisionSchema,
  AdminSchemaVersionSchema,
  AdminTimestampSchema
} from "./common";

const RoutePolicyIdSchema = z
  .string()
  .min(5)
  .max(120)
  .regex(/^rtp_[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

const RolloutRuleIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

const uniqueStrings = (values: readonly string[]): boolean => new Set(values).size === values.length;

const RateBpsSchema = z.number().int().min(0).max(10_000);

export const AdminRouteAllocationSchema = z.strictObject({
  providerId: AdminProviderIdSchema,
  allocationBps: RateBpsSchema
});

export const AdminRouteTrafficShareSchema = z.strictObject({
  providerId: AdminProviderIdSchema,
  shareBps: z.number().int().positive().max(10_000)
});

export const AdminRouteConcurrencyCapSchema = z.strictObject({
  providerId: AdminProviderIdSchema,
  limit: z.number().int().positive().max(1_000)
});

export const AdminRoutePolicyRevisionSchema = z
  .strictObject({
    schemaVersion: AdminSchemaVersionSchema,
    policyId: RoutePolicyIdSchema,
    platform: PlatformIdSchema,
    region: RegionIdSchema,
    revision: AdminRevisionSchema,
    revisionKind: z.enum(["draft", "published", "rollback"]),
    previousRevision: AdminRevisionSchema.nullable(),
    orderedProviderIds: z.array(AdminProviderIdSchema).max(16),
    rolloutRuleIds: z.array(RolloutRuleIdSchema).max(32),
    stagedAllocations: z.array(AdminRouteAllocationSchema).max(16).default([]),
    trafficShares: z.array(AdminRouteTrafficShareSchema).max(16).default([]),
    concurrencyCaps: z.array(AdminRouteConcurrencyCapSchema).max(16),
    reason: AdminReasonSchema,
    actorSubject: AdminActorSubjectSchema,
    createdAt: AdminTimestampSchema
  })
  .superRefine((policy, context) => {
    if (!uniqueStrings(policy.orderedProviderIds)) {
      context.addIssue({ code: "custom", message: "Provider preference IDs must be unique.", path: ["orderedProviderIds"] });
    }
    if (!uniqueStrings(policy.rolloutRuleIds)) {
      context.addIssue({ code: "custom", message: "Rollout rule IDs must be unique.", path: ["rolloutRuleIds"] });
    }
    if (!uniqueStrings(policy.stagedAllocations.map(({ providerId }) => providerId))) {
      context.addIssue({ code: "custom", message: "Staged allocations must be unique per Provider.", path: ["stagedAllocations"] });
    }
    if (!uniqueStrings(policy.trafficShares.map(({ providerId }) => providerId))) {
      context.addIssue({ code: "custom", message: "Traffic shares must be unique per Provider.", path: ["trafficShares"] });
    }
    if (policy.trafficShares.length > 0 && policy.trafficShares.reduce((sum, item) => sum + item.shareBps, 0) !== 10_000) {
      context.addIssue({ code: "custom", message: "Traffic shares must total exactly 10,000 basis points.", path: ["trafficShares"] });
    }
    if (!uniqueStrings(policy.concurrencyCaps.map(({ providerId }) => providerId))) {
      context.addIssue({ code: "custom", message: "Concurrency caps must be unique per Provider.", path: ["concurrencyCaps"] });
    }
    if (policy.previousRevision !== null && policy.previousRevision >= policy.revision) {
      context.addIssue({ code: "custom", message: "The previous revision must be older.", path: ["previousRevision"] });
    }
  });

const AdminIdempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

const routeConfirmation = (platform: string, region: string): string => `${platform}/${region}`;

const RouteCommandBaseSchema = z.strictObject({
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  expectedRevision: AdminRevisionSchema.nullable(),
  reason: AdminReasonSchema,
  confirmation: z.string().min(3).max(130),
  idempotencyKey: AdminIdempotencyKeySchema
});

export const AdminRoutePolicyDraftCommandSchema = RouteCommandBaseSchema.extend({
  orderedProviderIds: z.array(AdminProviderIdSchema).max(16),
  stagedAllocations: z.array(AdminRouteAllocationSchema).max(16),
  trafficShares: z.array(AdminRouteTrafficShareSchema).max(16).default([]),
  concurrencyCaps: z.array(AdminRouteConcurrencyCapSchema).max(16)
}).superRefine((command, context) => {
  if (command.confirmation !== routeConfirmation(command.platform, command.region)) {
    context.addIssue({ code: "custom", message: "Route confirmation does not match the exact scope.", path: ["confirmation"] });
  }
  for (const [path, values] of [
    ["orderedProviderIds", command.orderedProviderIds],
    ["stagedAllocations", command.stagedAllocations.map(({ providerId }) => providerId)],
    ["trafficShares", command.trafficShares.map(({ providerId }) => providerId)],
    ["concurrencyCaps", command.concurrencyCaps.map(({ providerId }) => providerId)]
  ] as const) {
    if (!uniqueStrings(values)) context.addIssue({ code: "custom", message: "Provider entries must be unique.", path: [path] });
  }
  if (command.trafficShares.length > 0 && command.trafficShares.reduce((sum, item) => sum + item.shareBps, 0) !== 10_000) {
    context.addIssue({ code: "custom", message: "Traffic shares must total exactly 10,000 basis points.", path: ["trafficShares"] });
  }
});

export const AdminRoutePolicyPublishCommandSchema = RouteCommandBaseSchema.extend({
  expectedRevision: AdminRevisionSchema,
  draftRevision: AdminRevisionSchema
}).superRefine((command, context) => {
  if (command.confirmation !== routeConfirmation(command.platform, command.region)) {
    context.addIssue({ code: "custom", message: "Route confirmation does not match the exact scope.", path: ["confirmation"] });
  }
});

export const AdminRoutePolicyDiscardCommandSchema = RouteCommandBaseSchema.extend({
  expectedRevision: AdminRevisionSchema,
  draftRevision: AdminRevisionSchema
}).superRefine((command, context) => {
  if (command.confirmation !== routeConfirmation(command.platform, command.region)) {
    context.addIssue({ code: "custom", message: "Route confirmation does not match the exact scope.", path: ["confirmation"] });
  }
});

export const AdminRoutePolicyRollbackCommandSchema = RouteCommandBaseSchema.extend({
  expectedRevision: AdminRevisionSchema,
  targetRevision: AdminRevisionSchema
}).superRefine((command, context) => {
  if (command.confirmation !== routeConfirmation(command.platform, command.region)) {
    context.addIssue({ code: "custom", message: "Route confirmation does not match the exact scope.", path: ["confirmation"] });
  }
});

export const AdminRoutePolicyViewSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  headRevision: AdminRevisionSchema.nullable(),
  baselineProviderIds: z.array(AdminProviderIdSchema).max(16),
  effectiveProviderIds: z.array(AdminProviderIdSchema).max(16),
  technicalProviderIds: z.array(AdminProviderIdSchema).max(128),
  excludedProviders: z.array(z.strictObject({
    providerId: AdminProviderIdSchema,
    reasons: z.array(z.enum(["disabled", "mock", "region_mismatch", "resolution_only"])).min(1).max(4)
  })).max(128),
  published: AdminRoutePolicyRevisionSchema.nullable(),
  draft: AdminRoutePolicyRevisionSchema.nullable(),
  propagation: z.strictObject({
    state: AdminPropagationStateSchema,
    durableRevision: AdminRevisionSchema.nullable(),
    projectedRevision: AdminRevisionSchema.nullable()
  })
});

export const AdminRouteSafetyCommandSchema = z.strictObject({
  action: z.enum(["pause", "emergency_deny", "resume"]),
  providerId: AdminProviderIdSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  expectedRolloutRevision: AdminRevisionSchema.nullable(),
  reason: AdminReasonSchema,
  confirmation: z.string().min(5).max(240),
  idempotencyKey: AdminIdempotencyKeySchema
}).superRefine((command,context)=>{
  if(command.confirmation!==`${command.providerId}/${command.platform}/${command.region}`){
    context.addIssue({code:"custom",message:"Safety confirmation does not match the exact route.",path:["confirmation"]});
  }
  if(command.action==="resume"&&command.expectedRolloutRevision===null){
    context.addIssue({code:"custom",message:"Resume requires the exact Admin deny revision.",path:["expectedRolloutRevision"]});
  }
});

export const AdminRouteProbeCommandSchema = z.strictObject({
  providerId: AdminProviderIdSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  expectedRolloutRevision: AdminRevisionSchema,
  reason: AdminReasonSchema,
  confirmation: z.string().min(5).max(240),
  idempotencyKey: AdminIdempotencyKeySchema
}).superRefine((command,context)=>{
  if(command.confirmation!==`${command.providerId}/${command.platform}/${command.region}`){
    context.addIssue({code:"custom",message:"Probe confirmation does not match the exact route.",path:["confirmation"]});
  }
});

export const AdminCsrfTokenSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  csrfToken: z.string().min(40).max(2_048),
  expiresInSeconds: z.number().int().min(30).max(900)
});

export const AdminMutationReceiptSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  commandId: z.string().regex(/^cmd_[a-f0-9]{32}$/),
  aggregate: z.enum(["route_policy", "platform_presentation", "locale", "page", "snapshot"]),
  targetId: z.string().min(1).max(160).regex(/^[A-Za-z0-9]+(?:[._:@/-][A-Za-z0-9]+)*$/),
  expectedRevision: AdminRevisionSchema.nullable(),
  acceptedRevision: AdminRevisionSchema.nullable(),
  currentRevision: AdminRevisionSchema.nullable(),
  propagatedRevision: AdminRevisionSchema.nullable(),
  state: AdminPropagationStateSchema,
  acceptedAt: AdminTimestampSchema,
  completedAt: AdminTimestampSchema.nullable()
});

export interface RoutePolicyEligibilityOptions {
  catalogPlatforms: readonly string[];
  manifests: readonly ProviderManifest[];
  maximumConcurrencyByProvider?: Readonly<Record<string, number>>;
  maximumConcurrencyForRoute?: (providerId:string,platform:string,region:string)=>number|undefined;
}

export function validateRoutePolicyEligibility(
  input: unknown,
  options: RoutePolicyEligibilityOptions
): AdminRoutePolicyRevision {
  const policy = AdminRoutePolicyRevisionSchema.parse(input);
  const catalog = new Set(options.catalogPlatforms.map((platform) => PlatformIdSchema.parse(platform)));
  if (!catalog.has(policy.platform)) {
    throw new Error(`Unknown platform catalog slug: ${policy.platform}`);
  }

  const manifests = new Map(
    options.manifests.map((manifestInput) => {
      const manifest = ProviderManifestSchema.parse(manifestInput);
      return [manifest.id, manifest] as const;
    })
  );
  const referenced = new Set([
    ...policy.orderedProviderIds,
    ...policy.stagedAllocations.map(({ providerId }) => providerId),
    ...policy.trafficShares.map(({ providerId }) => providerId),
    ...policy.concurrencyCaps.map(({ providerId }) => providerId)
  ]);

  for (const providerId of referenced) {
    const manifest = manifests.get(providerId);
    if (!manifest) {
      throw new Error(`Unknown Provider: ${providerId}`);
    }
    if (!manifest.enabled || manifest.kind === "mock") {
      throw new Error(`Provider is not production eligible: ${providerId}`);
    }
    if (!manifest.regions.includes("*") && !manifest.regions.includes(policy.region)) {
      throw new Error(`Provider is not eligible in region ${policy.region}: ${providerId}`);
    }
    if (!manifest.platforms.some(({ platform }) => platform === policy.platform)) {
      throw new Error(`Provider does not declare platform ${policy.platform}: ${providerId}`);
    }
    const capability = manifest.platforms.find(({ platform }) => platform === policy.platform);
    if (!capability || capability.deliveryModes.length === 0) {
      throw new Error(`Provider is resolution-only for platform ${policy.platform}: ${providerId}`);
    }
  }

  for (const share of policy.trafficShares ?? []) {
    if (!policy.orderedProviderIds.includes(share.providerId)) {
      throw new Error(`Traffic-share Provider is missing from the manual order: ${share.providerId}`);
    }
  }

  for (const cap of policy.concurrencyCaps) {
    const maximum = options.maximumConcurrencyForRoute?.(cap.providerId,policy.platform,policy.region)
      ?? options.maximumConcurrencyByProvider?.[cap.providerId];
    if (maximum === undefined || !Number.isInteger(maximum) || maximum < 1) {
      throw new Error(`Provider does not support an Admin concurrency cap: ${cap.providerId}`);
    }
    if (cap.limit > maximum) {
      throw new Error(`Concurrency cap exceeds the code-owned maximum for ${cap.providerId}`);
    }
  }

  return policy;
}

export type AdminRoutePolicyRevision = z.infer<typeof AdminRoutePolicyRevisionSchema>;
export type AdminMutationReceipt = z.infer<typeof AdminMutationReceiptSchema>;
export type AdminRoutePolicyDraftCommand = z.infer<typeof AdminRoutePolicyDraftCommandSchema>;
export type AdminRoutePolicyPublishCommand = z.infer<typeof AdminRoutePolicyPublishCommandSchema>;
export type AdminRoutePolicyDiscardCommand = z.infer<typeof AdminRoutePolicyDiscardCommandSchema>;
export type AdminRoutePolicyRollbackCommand = z.infer<typeof AdminRoutePolicyRollbackCommandSchema>;
export type AdminRoutePolicyView = z.infer<typeof AdminRoutePolicyViewSchema>;
export type AdminRouteSafetyCommand = z.infer<typeof AdminRouteSafetyCommandSchema>;
export type AdminRouteProbeCommand = z.infer<typeof AdminRouteProbeCommandSchema>;
