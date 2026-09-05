import { PlatformIdSchema, ProviderDeliveryModeSchema, RegionIdSchema } from "@tikdd/contracts";
import { z } from "zod";
import {
  AdminDeploymentIdSchema,
  AdminProviderIdSchema,
  AdminSchemaVersionSchema,
  AdminTimestampSchema,
  RouteTupleSchema
} from "./common";
import { AdminDegradedSourceSchema } from "./operations";

const RateBpsSchema = z.number().int().min(0).max(10_000);

export const AdminSupportStepIdSchema = z.enum([
  "catalog",
  "resolution",
  "delivery",
  "canary",
  "runtime",
  "lifecycle",
  "seo"
]);

export const AdminSupportStepStateSchema = z.enum(["pass", "warning", "block", "unavailable"]);

export const AdminSupportReasonCodeSchema = z.enum([
  "catalog_not_stable",
  "no_provider_capability",
  "provider_disabled",
  "region_mismatch",
  "no_delivery_mode",
  "delivery_unverified",
  "canary_not_configured",
  "canary_failed",
  "canary_stale",
  "canary_unavailable",
  "missing_rollout_grant",
  "restrictive_guard",
  "open_circuit",
  "circuit_stale",
  "insufficient_runtime_evidence",
  "runtime_data_unavailable",
  "platform_not_listed",
  "content_incomplete",
  "seo_ineligible"
]);

export const AdminSupportReasonSchema = z.strictObject({
  code: AdminSupportReasonCodeSchema,
  providerId: AdminProviderIdSchema.nullable()
});

export const AdminSupportStepSchema = z.strictObject({
  id: AdminSupportStepIdSchema,
  state: AdminSupportStepStateSchema,
  observedAt: AdminTimestampSchema.nullable()
});

export const AdminProviderTruthSchema = z.strictObject({
  tuple: RouteTupleSchema,
  displayName: z.string().min(1).max(100),
  manifestEnabled: z.boolean(),
  regionEligible: z.boolean(),
  resolutionCapable: z.boolean(),
  deliveryModes: z.array(ProviderDeliveryModeSchema).max(3),
  deliveryVerified: z.boolean(),
  canaryState: z.enum(["fresh", "stale", "failed", "unavailable", "not_configured"]),
  canaryObservedAt: AdminTimestampSchema.nullable(),
  allocationBps: RateBpsSchema,
  guardAction: z.enum(["hold", "reduce", "deny", "eligible_for_review"]).nullable(),
  circuitState: z.enum(["closed", "open", "half_open", "unknown"]),
  runtimeState: z.enum(["healthy", "warning", "open", "paused", "insufficient_data", "stale", "unavailable", "not_routed"]),
  reasons: z.array(AdminSupportReasonCodeSchema).max(20)
});

export const AdminPlatformTruthSchema = z.strictObject({
  platform: PlatformIdSchema,
  displayName: z.string().min(1).max(100),
  region: RegionIdSchema,
  catalogStatus: z.enum(["stable", "experimental", "planned", "paused"]),
  publicAvailability: z.enum(["hidden", "preview", "listed", "paused"]),
  contentCoverageBps: RateBpsSchema,
  currentAvailability: z.enum(["available", "degraded", "unavailable"]),
  indexEligibility: z.enum(["eligible", "ineligible", "unavailable"]),
  ladder: z.array(AdminSupportStepSchema).length(7),
  reasons: z.array(AdminSupportReasonSchema).max(100),
  providers: z.array(AdminProviderTruthSchema).max(100)
}).superRefine((value, context) => {
  const ids = value.ladder.map(({ id }) => id);
  if (new Set(ids).size !== 7 || AdminSupportStepIdSchema.options.some((id) => !ids.includes(id))) {
    context.addIssue({ code: "custom", path: ["ladder"], message: "Support ladder must contain every step exactly once." });
  }
});

export const AdminOperationalServiceTruthSchema = z.strictObject({
  service: z.enum(["canary", "evidence", "cleanup"]),
  state: z.enum(["running", "completed", "degraded", "failed", "lease_unavailable", "missing"]),
  freshness: z.enum(["missing", "fresh", "degraded", "stale", "failed"]),
  ready: z.boolean(),
  observedAt: AdminTimestampSchema.nullable(),
  nextExpectedAt: AdminTimestampSchema.nullable(),
  consecutiveFailures: z.number().int().nonnegative().max(10)
});

export const AdminOperationalTruthSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  deployment: AdminDeploymentIdSchema,
  region: RegionIdSchema,
  generatedAt: AdminTimestampSchema,
  degradedSources: z.array(AdminDegradedSourceSchema).max(8),
  services: z.array(AdminOperationalServiceTruthSchema).length(3),
  platforms: z.array(AdminPlatformTruthSchema).max(500)
});

export type AdminOperationalTruth = z.infer<typeof AdminOperationalTruthSchema>;
export type AdminPlatformTruth = z.infer<typeof AdminPlatformTruthSchema>;
export type AdminProviderTruth = z.infer<typeof AdminProviderTruthSchema>;
export type AdminSupportReasonCode = z.infer<typeof AdminSupportReasonCodeSchema>;
export type AdminSupportStep = z.infer<typeof AdminSupportStepSchema>;
