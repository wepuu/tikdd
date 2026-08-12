import { PlatformIdSchema, ProviderDeliveryModeSchema, RegionIdSchema } from "@tikdd/contracts";
import { z } from "zod";
import {
  AdminActorSubjectSchema,
  AdminProviderIdSchema,
  AdminReasonSchema,
  AdminRevisionSchema,
  AdminSchemaVersionSchema,
  AdminTimestampSchema
} from "./common";

const IdempotencyKeySchema = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);
const PageIdSchema = z.string().regex(/^page_[a-z0-9]+(?:[._-][a-z0-9]+)*$/);
const DisplayNameSchema = z.string().trim().min(1).max(100);
const SupportLabelSchema = z.string().trim().min(1).max(80);

export const AdminPlatformPresentationRevisionSchemaV2 = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  revision: AdminRevisionSchema,
  revisionKind: z.enum(["draft", "published", "rollback"]),
  previousRevision: AdminRevisionSchema.nullable(),
  publicDisplayName: DisplayNameSchema,
  supportLabel: SupportLabelSchema,
  publicAvailability: z.enum(["hidden", "preview", "listed", "paused"]),
  pageId: PageIdSchema.nullable(),
  reason: AdminReasonSchema,
  actorSubject: AdminActorSubjectSchema,
  createdAt: AdminTimestampSchema
}).superRefine((revision, context) => {
  if (revision.previousRevision !== null && revision.previousRevision >= revision.revision) {
    context.addIssue({ code: "custom", message: "The previous revision must be older.", path: ["previousRevision"] });
  }
});

const PlatformCommandBaseSchema = z.strictObject({
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  expectedRevision: AdminRevisionSchema.nullable(),
  reason: AdminReasonSchema,
  confirmation: z.string().min(3).max(130),
  idempotencyKey: IdempotencyKeySchema
});

function exactScope(command: { platform: string; region: string }, context: z.RefinementCtx): void {
  if ((command as { confirmation?: string }).confirmation !== `${command.platform}/${command.region}`) {
    context.addIssue({ code: "custom", message: "Platform confirmation does not match the exact scope.", path: ["confirmation"] });
  }
}

export const AdminPlatformDraftCommandSchema = PlatformCommandBaseSchema.extend({
  publicDisplayName: DisplayNameSchema,
  supportLabel: SupportLabelSchema,
  publicAvailability: z.enum(["hidden", "preview", "listed", "paused"]),
  pageId: PageIdSchema.nullable()
}).superRefine(exactScope);

export const AdminPlatformPublishCommandSchema = PlatformCommandBaseSchema.extend({
  expectedRevision: AdminRevisionSchema,
  draftRevision: AdminRevisionSchema
}).superRefine(exactScope);

export const AdminPlatformDiscardCommandSchema = AdminPlatformPublishCommandSchema;

export const AdminPlatformRollbackCommandSchema = PlatformCommandBaseSchema.extend({
  expectedRevision: AdminRevisionSchema,
  targetRevision: AdminRevisionSchema
}).superRefine(exactScope);

export const AdminPlatformReadinessBlockerSchema = z.enum([
  "catalog_not_stable",
  "no_monitored_eligible_route",
  "no_healthy_route",
  "page_not_associated",
  "page_not_published",
  "locale_coverage_incomplete",
  "seo_not_ready",
  "operational_data_unavailable"
]);

export const AdminPlatformManagementViewSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  headRevision: AdminRevisionSchema.nullable(),
  catalog: z.strictObject({
    displayName: DisplayNameSchema,
    status: z.enum(["stable", "experimental", "planned", "paused"]),
    source: z.enum(["curated", "yt-dlp"]),
    recognizedHosts: z.array(z.strictObject({ hostname: z.string().min(1).max(253), allowSubdomains: z.boolean() })).max(64),
    extractorKeys: z.array(z.string().min(1).max(160)).max(128)
  }),
  adapterCapabilities: z.array(z.strictObject({
    providerId: AdminProviderIdSchema,
    displayName: DisplayNameSchema,
    enabled: z.boolean(),
    regions: z.array(z.union([RegionIdSchema, z.literal("*")])).min(1).max(32),
    basePriority: z.number().int().min(0).max(1_000),
    deliveryModes: z.array(ProviderDeliveryModeSchema).max(3),
    productionEligible: z.boolean()
  })).max(64),
  readiness: z.strictObject({
    monitoredEligibleRouteCount: z.number().int().nonnegative().max(500),
    healthyRouteCount: z.number().int().nonnegative().max(500),
    publishedLocaleCount: z.number().int().nonnegative().max(100),
    publishedPageLocaleCount: z.number().int().nonnegative().max(100),
    seoReady: z.boolean(),
    indexableEligible: z.boolean(),
    blockers: z.array(AdminPlatformReadinessBlockerSchema).max(8)
  }),
  baseline: z.strictObject({
    publicDisplayName: DisplayNameSchema,
    supportLabel: SupportLabelSchema,
    publicAvailability: z.enum(["hidden", "preview", "paused"]),
    pageId: z.null()
  }),
  published: AdminPlatformPresentationRevisionSchemaV2.nullable(),
  draft: AdminPlatformPresentationRevisionSchemaV2.nullable(),
  effective: z.strictObject({
    publicDisplayName: DisplayNameSchema,
    supportLabel: SupportLabelSchema,
    publicAvailability: z.enum(["hidden", "preview", "listed", "paused"]),
    pageId: PageIdSchema.nullable()
  })
});

export type AdminPlatformPresentationRevisionV2 = z.infer<typeof AdminPlatformPresentationRevisionSchemaV2>;
export type AdminPlatformDraftCommand = z.infer<typeof AdminPlatformDraftCommandSchema>;
export type AdminPlatformPublishCommand = z.infer<typeof AdminPlatformPublishCommandSchema>;
export type AdminPlatformDiscardCommand = z.infer<typeof AdminPlatformDiscardCommandSchema>;
export type AdminPlatformRollbackCommand = z.infer<typeof AdminPlatformRollbackCommandSchema>;
export type AdminPlatformManagementView = z.infer<typeof AdminPlatformManagementViewSchema>;
