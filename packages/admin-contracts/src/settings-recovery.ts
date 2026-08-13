import { z } from "zod";
import { AdminDependencyStateSchema } from "./operations";
import { AdminRevisionSchema, AdminSchemaVersionSchema, AdminTimestampSchema } from "./common";
import { ApprovedAssetIdSchema, LocaleTagSchema } from "./editorial";

const ReadinessSchema = z.enum(["ready", "degraded", "unavailable"]);
const PresenceSchema = z.enum(["configured", "missing"]);
const SnapshotIdSchema = z.string().regex(/^snap_[a-f0-9]{32}$/);

export const AdminSiteIdentitySettingSchema = z.strictObject({
  locale: LocaleTagSchema,
  revision: AdminRevisionSchema.nullable(),
  state: z.enum(["missing", "draft", "ready", "published", "archived"]),
  siteName: z.string().trim().min(1).max(80),
  navigationLabel: z.string().trim().min(1).max(80),
  footerTagline: z.string().trim().min(1).max(240),
  legalNoticeMarkdown: z.string().trim().min(1).max(2_000),
  defaultSocial: z.strictObject({
    title: z.string().trim().min(1).max(100).nullable(),
    description: z.string().trim().min(1).max(240).nullable(),
    imageAssetId: ApprovedAssetIdSchema.nullable()
  })
});

export const AdminLocaleSettingSchema = z.strictObject({
  locale: LocaleTagSchema,
  revision: AdminRevisionSchema,
  displayName: z.string().trim().min(1).max(100),
  direction: z.enum(["ltr", "rtl"]),
  fallbackLocale: LocaleTagSchema.nullable(),
  enabled: z.boolean(),
  isDefault: z.boolean(),
  state: z.enum(["draft", "ready", "published", "archived"])
});

export const AdminSettingsRecoveryViewSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  generatedAt: AdminTimestampSchema,
  siteIdentity: z.array(AdminSiteIdentitySettingSchema).max(100),
  locales: z.array(AdminLocaleSettingSchema).min(1).max(100),
  publicationDefaults: z.strictObject({
    defaultLocale: LocaleTagSchema,
    fallbackMaySatisfyPublication: z.literal(false),
    requiredPagePolicy: z.literal("complete_code_owned_set")
  }),
  infrastructure: z.strictObject({
    deployment: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    region: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    ownerAccess: z.strictObject({ mode: z.literal("password"), state: z.literal("configured") }),
    edge: z.strictObject({ cloudflare: PresenceSchema, nginx: PresenceSchema }),
    state: ReadinessSchema,
    dependencies: z.array(AdminDependencyStateSchema).max(12),
    scheduler: z.strictObject({ state: z.enum(["healthy", "stale", "unavailable"]), observedAt: AdminTimestampSchema.nullable() }),
    snapshot: z.strictObject({
      state: ReadinessSchema,
      activeSnapshotId: SnapshotIdSchema.nullable(),
      activeRevision: AdminRevisionSchema.nullable(),
      latestRevision: AdminRevisionSchema.nullable(),
      propagationState: z.enum(["idle", "propagating", "propagated", "propagation_failed"]),
      affectedPathCount: z.number().int().nonnegative().max(10_000)
    })
  }),
  secretPresence: z.array(z.strictObject({
    id: z.enum(["origin_proof", "csrf_signing", "command_signing", "web_revalidation"]),
    state: PresenceSchema
  })).length(4),
  recovery: z.strictObject({
    retryPublication: z.strictObject({ available: z.boolean(), snapshotId: SnapshotIdSchema.nullable() }),
    rebuildSnapshot: z.strictObject({ available: z.boolean(), sourceSnapshotId: SnapshotIdSchema.nullable() }),
    invalidateContentCache: z.strictObject({ available: z.boolean(), snapshotId: SnapshotIdSchema.nullable(), affectedPathCount: z.number().int().nonnegative().max(10_000) }),
    rollbackCandidates: z.array(z.strictObject({ revision: AdminRevisionSchema, snapshotId: SnapshotIdSchema, generatedAt: AdminTimestampSchema })).max(20)
  })
});

export type AdminSettingsRecoveryView = z.infer<typeof AdminSettingsRecoveryViewSchema>;
