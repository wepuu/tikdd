import { z } from "zod";

export const PlatformIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const PlatformSchema = PlatformIdSchema;
export type PlatformId = z.infer<typeof PlatformIdSchema>;
export type Platform = PlatformId;

export const RegionIdSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type RegionId = z.infer<typeof RegionIdSchema>;

export const ProviderRegionSchema = z.union([RegionIdSchema, z.literal("*")]);
export type ProviderRegion = z.infer<typeof ProviderRegionSchema>;

export const PlatformSupportStatusSchema = z.enum([
  "stable",
  "experimental",
  "planned",
  "paused"
]);
export type PlatformSupportStatus = z.infer<typeof PlatformSupportStatusSchema>;

export const PlatformSummarySchema = z.object({
  id: PlatformIdSchema,
  displayName: z.string().min(1).max(100),
  status: PlatformSupportStatusSchema,
  source: z.enum(["curated", "yt-dlp"]),
  providerCount: z.number().int().nonnegative()
});
export type PlatformSummary = z.infer<typeof PlatformSummarySchema>;

export const ProviderKindSchema = z.enum(["api", "site-adapter", "yt-dlp", "mock"]);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

export const ProviderDeliveryModeSchema = z.enum(["redirect", "proxy", "temporary-object"]);
export type ProviderDeliveryMode = z.infer<typeof ProviderDeliveryModeSchema>;

export const ProviderCapabilityVerificationStatusSchema = z.enum([
  "unverified",
  "fixture_verified",
  "canary_failed",
  "canary_verified",
  "delivery_verified"
]);
export type ProviderCapabilityVerificationStatus = z.infer<
  typeof ProviderCapabilityVerificationStatusSchema
>;

export const ProviderPlatformCapabilitySchema = z
  .strictObject({
    platform: PlatformIdSchema,
    priority: z.number().int().min(0).max(1000),
    deliveryModes: z.array(ProviderDeliveryModeSchema).max(3),
    verificationStatus: ProviderCapabilityVerificationStatusSchema
  })
  .superRefine((capability, context) => {
    if (new Set(capability.deliveryModes).size !== capability.deliveryModes.length) {
      context.addIssue({
        code: "custom",
        message: `Duplicate delivery mode for ${capability.platform}.`,
        path: ["deliveryModes"]
      });
    }
    if (capability.deliveryModes.length > 0 && capability.verificationStatus !== "delivery_verified") {
      context.addIssue({
        code: "custom",
        message: `Deliverable capability ${capability.platform} must be delivery verified.`,
        path: ["verificationStatus"]
      });
    }
  });
export type ProviderPlatformCapability = z.infer<typeof ProviderPlatformCapabilitySchema>;

export const ProviderManifestSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
    displayName: z.string().min(1).max(100),
    kind: ProviderKindSchema,
    enabled: z.boolean(),
    regions: z.array(ProviderRegionSchema).min(1),
    timeoutMs: z.number().int().min(100).max(120_000),
    costWeight: z.number().min(0).max(1000),
    platforms: z.array(ProviderPlatformCapabilitySchema).min(1)
  })
  .superRefine((manifest, context) => {
    const seen = new Set<string>();
    for (const capability of manifest.platforms) {
      if (seen.has(capability.platform)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate platform capability: ${capability.platform}`,
          path: ["platforms"]
        });
      }
      seen.add(capability.platform);
    }
  });
export type ProviderManifest = z.infer<typeof ProviderManifestSchema>;

export const ProviderFailureCodeSchema = z.enum([
  "invalid_url",
  "unsupported_url",
  "content_not_found",
  "content_private",
  "authentication_required",
  "payment_required",
  "drm_protected",
  "geo_restricted",
  "provider_timeout",
  "provider_rate_limited",
  "provider_challenge",
  "provider_schema_changed",
  "provider_unavailable",
  "invalid_result",
  "internal_error"
]);
export type ProviderFailureCode = z.infer<typeof ProviderFailureCodeSchema>;

export const ProviderAttemptSchema = z.object({
  providerId: z.string().min(1).max(100),
  providerKind: ProviderKindSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  priority: z.number().int().min(0).max(1000),
  routeScore: z.number(),
  status: z.enum(["succeeded", "failed"]),
  failureCode: ProviderFailureCodeSchema.nullable(),
  retryable: z.boolean().nullable(),
  fallbackAllowed: z.boolean().nullable(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative()
});
export type ProviderAttempt = z.infer<typeof ProviderAttemptSchema>;

export const ResolveTaskStatusSchema = z.enum([
  "queued",
  "detecting",
  "resolving",
  "succeeded",
  "failed",
  "expired"
]);
export type ResolveTaskStatus = z.infer<typeof ResolveTaskStatusSchema>;

export const MediaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  author: z.string().max(200).nullable(),
  thumbnailUrl: z.string().url().nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  isLive: z.boolean()
});
export type Media = z.infer<typeof MediaSchema>;

export const MediaFormatSchema = z.object({
  id: z.string().min(1),
  container: z.string().min(1).max(24),
  mimeType: z.string().min(1).max(100),
  quality: z.string().min(1).max(80),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  fps: z.number().positive().nullable(),
  bitrateKbps: z.number().nonnegative().nullable(),
  estimatedBytes: z.number().int().nonnegative().nullable(),
  videoCodec: z.string().max(80).nullable(),
  audioCodec: z.string().max(80).nullable(),
  hasVideo: z.boolean(),
  hasAudio: z.boolean()
});
export type MediaFormat = z.infer<typeof MediaFormatSchema>;

export const ResolveResultSchema = z.object({
  schemaVersion: z.literal("1.0"),
  source: z.object({
    platform: PlatformSchema,
    canonicalUrl: z.string().url()
  }),
  media: MediaSchema,
  formats: z.array(MediaFormatSchema).min(1),
  provenance: z.object({
    provider: z.string().min(1),
    kind: ProviderKindSchema,
    cacheHit: z.boolean(),
    resolvedAt: z.string().datetime()
  }),
  warnings: z.array(z.string().min(1).max(300)).max(20)
});
export type ResolveResult = z.infer<typeof ResolveResultSchema>;

export const TaskErrorSchema = z.object({
  code: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  retryable: z.boolean()
});
export type TaskError = z.infer<typeof TaskErrorSchema>;

export const ResolveTaskSchema = z.object({
  id: z.string().regex(/^tsk_[a-f0-9]{32}$/),
  status: ResolveTaskStatusSchema,
  platform: PlatformSchema,
  canonicalUrl: z.string().url(),
  result: ResolveResultSchema.nullable(),
  error: TaskErrorSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime()
});
export type ResolveTask = z.infer<typeof ResolveTaskSchema>;

export const CreateResolveTaskRequestSchema = z.object({
  url: z.string().trim().url().max(2048),
  confirmedRights: z.literal(true)
});
export type CreateResolveTaskRequest = z.infer<typeof CreateResolveTaskRequestSchema>;

export const IdempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

export const ResolveTaskAdmissionErrorCodeSchema = z.enum([
  "IDEMPOTENCY_CONFLICT",
  "DUPLICATE_IN_PROGRESS",
  "RATE_LIMITED",
  "CONCURRENCY_LIMITED",
  "ADMISSION_UNAVAILABLE"
]);
export type ResolveTaskAdmissionErrorCode = z.infer<
  typeof ResolveTaskAdmissionErrorCodeSchema
>;

export const CreateDeliveryRequestSchema = z.object({
  taskId: z.string().regex(/^tsk_[a-f0-9]{32}$/),
  formatId: z.string().min(1).max(160)
});
export type CreateDeliveryRequest = z.infer<typeof CreateDeliveryRequestSchema>;

export const DeliverySchema = z.object({
  id: z.string().min(1),
  mode: ProviderDeliveryModeSchema,
  url: z.string().url(),
  expiresAt: z.string().datetime()
});
export type Delivery = z.infer<typeof DeliverySchema>;

export const ResolveJobDataSchema = z.object({
  taskId: z.string().regex(/^tsk_[a-f0-9]{32}$/),
  admissionPermitId: z
    .string()
    .regex(/^(?:tsk_[a-f0-9]{32}|adp_[a-f0-9]{64})$/)
    .optional(),
  admissionReferenceId: z.string().regex(/^adr_[a-f0-9]{32}$/).optional(),
  sourceUrl: z.string().url(),
  platform: PlatformSchema
});
export type ResolveJobData = z.infer<typeof ResolveJobDataSchema>;

export const ApiErrorSchema = z.object({
  error: TaskErrorSchema
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
