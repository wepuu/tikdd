import { PlatformIdSchema, ProviderCapabilityVerificationStatusSchema, ProviderDeliveryModeSchema, ProviderKindSchema, RegionIdSchema } from "@tikdd/contracts";
import { z } from "zod";
import {
  AdminDeploymentIdSchema,
  AdminOperationalStateSchema,
  AdminProviderIdSchema,
  AdminRevisionSchema,
  AdminSchemaVersionSchema,
  AdminTimestampSchema,
  RouteTupleSchema
} from "./common";

const BoundedCountSchema = z.number().int().nonnegative().max(1_000_000_000);
const RateBpsSchema = z.number().int().min(0).max(10_000);
const DurationSchema = z.number().int().nonnegative().max(120_000);

export const AdminDegradedSourceSchema = z.enum([
  "postgres",
  "redis",
  "queue",
  "routing_health",
  "rollout",
  "pilot_guard",
  "operations",
  "editorial"
]);

export const AdminDependencyStateSchema = z.strictObject({
  id: z.enum(["postgres", "redis", "queue", "scheduler", "evidence", "content_snapshot"]),
  state: z.enum(["healthy", "stale", "unavailable"]),
  observedAt: AdminTimestampSchema.nullable()
});

export const AdminOverviewSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  deployment: AdminDeploymentIdSchema,
  region: RegionIdSchema,
  generatedAt: AdminTimestampSchema,
  state: AdminOperationalStateSchema,
  queue: z.strictObject({
    queued: BoundedCountSchema,
    active: BoundedCountSchema,
    succeeded: BoundedCountSchema,
    failed: BoundedCountSchema
  }),
  delivery: z.strictObject({
    handoffCount: BoundedCountSchema,
    failureCount: BoundedCountSchema,
    successRateBps: RateBpsSchema.nullable()
  }),
  routes: z.strictObject({
    total: BoundedCountSchema,
    degraded: BoundedCountSchema,
    activeDenies: BoundedCountSchema
  }),
  publishing: z.strictObject({
    pendingDrafts: BoundedCountSchema,
    localeGaps: BoundedCountSchema,
    seoBlockers: BoundedCountSchema,
    activeSnapshotRevision: AdminRevisionSchema.nullable()
  }),
  dependencies: z.array(AdminDependencyStateSchema).max(12)
});

export const AdminRouteSummarySchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  tuple: RouteTupleSchema,
  providerDisplayName: z.string().min(1).max(100),
  providerKind: ProviderKindSchema,
  manifestEnabled: z.boolean(),
  basePriority: z.number().int().min(0).max(1_000),
  deliveryModes: z.array(ProviderDeliveryModeSchema).max(3),
  verificationStatus: ProviderCapabilityVerificationStatusSchema,
  productionEligible: z.boolean(),
  preferencePosition: z.number().int().positive().max(64).nullable(),
  allocationBps: RateBpsSchema,
  trafficShareBps: RateBpsSchema,
  state: AdminOperationalStateSchema,
  rolloutRevision: AdminRevisionSchema.nullable(),
  policyRevision: AdminRevisionSchema.nullable(),
  circuitState: z.enum(["closed", "open", "half_open", "unknown"]),
  successRateBps: RateBpsSchema.nullable(),
  p50LatencyMs: DurationSchema.nullable(),
  p95LatencyMs: DurationSchema.nullable(),
  activeConcurrency: BoundedCountSchema.nullable(),
  concurrencyLimit: BoundedCountSchema.nullable(),
  fallbackRateBps: RateBpsSchema.nullable(),
  sampleCount: BoundedCountSchema,
  observedAt: AdminTimestampSchema.nullable()
});

export const AdminRouteSeriesPointSchema = z.strictObject({
  bucketStartedAt: AdminTimestampSchema,
  successRateBps: RateBpsSchema.nullable(),
  p95LatencyMs: DurationSchema.nullable(),
  sampleCount: BoundedCountSchema
});

export const AdminRouteFailureSchema = z.strictObject({
  code: z.enum([
    "timeout",
    "rate_limited",
    "challenge",
    "schema",
    "availability",
    "invalid_result",
    "terminal_content",
    "other"
  ]),
  count: BoundedCountSchema
});

export const AdminRouteDetailSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  summary: AdminRouteSummarySchema,
  windowStartedAt: AdminTimestampSchema,
  windowEndedAt: AdminTimestampSchema,
  series: z.array(AdminRouteSeriesPointSchema).max(288),
  failures: z.array(AdminRouteFailureSchema).max(8),
  canary: z.strictObject({
    state: z.enum(["fresh", "stale", "running", "failed", "unavailable", "not_configured"]),
    observedAt: AdminTimestampSchema.nullable()
  })
});

export const AdminProviderProjectionSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  id: AdminProviderIdSchema,
  displayName: z.string().min(1).max(100),
  kind: ProviderKindSchema,
  enabled: z.boolean(),
  regions: z.array(z.union([RegionIdSchema, z.literal("*")])).min(1).max(32),
  timeoutMs: DurationSchema,
  costWeight: z.number().min(0).max(1_000),
  capabilities: z
    .array(
      z.strictObject({
        platform: PlatformIdSchema,
        basePriority: z.number().int().min(0).max(1_000),
        deliveryModes: z.array(ProviderDeliveryModeSchema).max(3),
        verificationStatus: ProviderCapabilityVerificationStatusSchema,
        productionEligible: z.boolean()
      })
    )
    .min(1)
    .max(128)
});

export const AdminPlatformProjectionSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  id: PlatformIdSchema,
  displayName: z.string().min(1).max(100),
  catalogStatus: z.enum(["stable", "experimental", "planned", "paused"]),
  catalogSource: z.enum(["curated", "yt-dlp"]),
  recognizedHosts: z
    .array(
      z.strictObject({
        hostname: z
          .string()
          .min(1)
          .max(253)
          .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/),
        allowSubdomains: z.boolean()
      })
    )
    .min(1)
    .max(64),
  providerCount: BoundedCountSchema,
  healthyRouteCount: BoundedCountSchema,
  publicAvailability: z.enum(["hidden", "preview", "listed", "paused"]),
  contentCoverageBps: RateBpsSchema,
  seoReady: z.boolean()
});

export const AdminRouteListSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  generatedAt: AdminTimestampSchema,
  degradedSources: z.array(AdminDegradedSourceSchema).max(8),
  routes: z.array(AdminRouteSummarySchema).max(2_000)
});

export const AdminProviderListSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  generatedAt: AdminTimestampSchema,
  providers: z.array(AdminProviderProjectionSchema).max(500)
});

export const AdminPlatformListSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  generatedAt: AdminTimestampSchema,
  degradedSources: z.array(AdminDegradedSourceSchema).max(8),
  platforms: z.array(AdminPlatformProjectionSchema).max(500)
});

export const AdminRuntimeSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  deployment: AdminDeploymentIdSchema,
  region: RegionIdSchema,
  authMode: z.literal("password"),
  generatedAt: AdminTimestampSchema,
  state: z.enum(["ready", "degraded", "unavailable"]),
  dependencies: z.array(AdminDependencyStateSchema).max(12),
  scheduler: z.strictObject({
    state: z.enum(["healthy", "stale", "unavailable"]),
    observedAt: AdminTimestampSchema.nullable()
  }),
  activeSnapshotRevision: AdminRevisionSchema.nullable()
});

export type AdminOverview = z.infer<typeof AdminOverviewSchema>;
export type AdminRouteSummary = z.infer<typeof AdminRouteSummarySchema>;
export type AdminRouteDetail = z.infer<typeof AdminRouteDetailSchema>;
export type AdminProviderProjection = z.infer<typeof AdminProviderProjectionSchema>;
export type AdminPlatformProjection = z.infer<typeof AdminPlatformProjectionSchema>;
export type AdminRouteList = z.infer<typeof AdminRouteListSchema>;
export type AdminProviderList = z.infer<typeof AdminProviderListSchema>;
export type AdminPlatformList = z.infer<typeof AdminPlatformListSchema>;
export type AdminRuntime = z.infer<typeof AdminRuntimeSchema>;
