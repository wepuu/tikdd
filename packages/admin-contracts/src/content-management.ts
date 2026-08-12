import { z } from "zod";
import {
  AdminLocaleRevisionSchema,
  AdminPageContentSchema,
  AdminPageRevisionSchema,
  AdminSeoFieldsSchema,
  LocaleTagSchema
} from "./editorial";
import {
  AdminReasonSchema,
  AdminRevisionSchema,
  AdminSchemaVersionSchema
} from "./common";

const IdempotencyKeySchema = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const AdminPageIdSchema = z.string().regex(/^page_[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

export const AdminPageDefinitionSchema = z.strictObject({
  pageId: AdminPageIdSchema,
  pageType: z.enum(["homepage", "platform", "guide", "faq", "legal"]),
  platform: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable(),
  label: z.string().trim().min(1).max(100),
  required: z.boolean(),
  templateVersion: z.number().int().positive().max(1_000)
}).superRefine((definition, context) => {
  if ((definition.pageType === "platform") !== (definition.platform !== null)) {
    context.addIssue({ code: "custom", message: "Only platform definitions carry a platform slug.", path: ["platform"] });
  }
});

const CommandBaseSchema = z.strictObject({
  expectedRevision: AdminRevisionSchema.nullable(),
  reason: AdminReasonSchema,
  idempotencyKey: IdempotencyKeySchema
});

export const AdminLocaleDraftCommandSchema = CommandBaseSchema.extend({
  locale: LocaleTagSchema,
  displayName: z.string().trim().min(1).max(100),
  direction: z.enum(["ltr", "rtl"]),
  fallbackLocale: LocaleTagSchema.nullable(),
  enabled: z.boolean(),
  isDefault: z.boolean(),
  state: z.enum(["draft", "ready"]),
  confirmation: z.string().min(2).max(35)
}).superRefine((command, context) => {
  if (command.confirmation !== command.locale) context.addIssue({ code: "custom", message: "Locale confirmation must match the exact tag.", path: ["confirmation"] });
  if (command.fallbackLocale === command.locale) context.addIssue({ code: "custom", message: "A locale cannot fall back to itself.", path: ["fallbackLocale"] });
  if (command.isDefault && command.fallbackLocale !== null) context.addIssue({ code: "custom", message: "The default locale cannot have a fallback.", path: ["fallbackLocale"] });
});

export const AdminLocaleDiscardCommandSchema = z.strictObject({
  locale: LocaleTagSchema,
  expectedRevision: AdminRevisionSchema,
  draftRevision: AdminRevisionSchema,
  reason: AdminReasonSchema,
  confirmation: LocaleTagSchema,
  idempotencyKey: IdempotencyKeySchema
}).superRefine((command, context) => {
  if (command.confirmation !== command.locale) context.addIssue({ code: "custom", message: "Locale confirmation must match the exact tag.", path: ["confirmation"] });
});

export const AdminPageDraftCommandSchema = CommandBaseSchema.extend({
  pageId: AdminPageIdSchema,
  locale: LocaleTagSchema,
  pageType: z.enum(["homepage", "platform", "guide", "faq", "legal"]),
  platform: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable(),
  state: z.enum(["draft", "ready"]),
  content: AdminPageContentSchema,
  seo: AdminSeoFieldsSchema,
  confirmation: z.string().min(8).max(160)
}).superRefine((command, context) => {
  if (command.confirmation !== `${command.pageId}/${command.locale}`) context.addIssue({ code: "custom", message: "Page confirmation must match the exact page and locale.", path: ["confirmation"] });
  if (command.content.template !== command.pageType) context.addIssue({ code: "custom", message: "Content template must match the page definition.", path: ["content", "template"] });
  if ((command.pageType === "platform") !== (command.platform !== null)) context.addIssue({ code: "custom", message: "Only platform pages require a platform slug.", path: ["platform"] });
});

export const AdminPageDiscardCommandSchema = z.strictObject({
  pageId: AdminPageIdSchema,
  locale: LocaleTagSchema,
  expectedRevision: AdminRevisionSchema,
  draftRevision: AdminRevisionSchema,
  reason: AdminReasonSchema,
  confirmation: z.string().min(8).max(160),
  idempotencyKey: IdempotencyKeySchema
}).superRefine((command, context) => {
  if (command.confirmation !== `${command.pageId}/${command.locale}`) context.addIssue({ code: "custom", message: "Page confirmation must match the exact page and locale.", path: ["confirmation"] });
});

export const AdminSharedContentSchema = z.strictObject({
  navigationLabel: z.string().trim().min(1).max(80),
  footerTagline: z.string().trim().min(1).max(240),
  legalNoticeMarkdown: z.string().trim().min(1).max(2_000).refine((value) => !/[<>]/.test(value), "Raw HTML is not allowed.")
});

export const AdminSharedContentRevisionSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  locale: LocaleTagSchema,
  revision: AdminRevisionSchema,
  state: z.enum(["draft", "ready", "published", "archived"]),
  content: AdminSharedContentSchema,
  reason: AdminReasonSchema,
  actorSubject: z.string().min(1).max(160),
  createdAt: z.iso.datetime({ offset: true })
});

export const AdminSharedContentDraftCommandSchema = CommandBaseSchema.extend({
  locale: LocaleTagSchema,
  state: z.enum(["draft", "ready"]),
  content: AdminSharedContentSchema,
  confirmation: LocaleTagSchema
}).superRefine((command, context) => {
  if (command.confirmation !== command.locale) context.addIssue({ code: "custom", message: "Shared-content confirmation must match the exact locale.", path: ["confirmation"] });
});

export const AdminContentCoverageCellSchema = z.strictObject({
  pageId: AdminPageIdSchema,
  locale: LocaleTagSchema,
  status: z.enum(["missing", "fallback", "draft", "ready", "published", "archived"]),
  revision: AdminRevisionSchema.nullable(),
  fallbackLocale: LocaleTagSchema.nullable(),
  fallbackRevision: AdminRevisionSchema.nullable()
});

export const AdminContentManagementViewSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  generatedAt: z.iso.datetime({ offset: true }),
  locales: z.array(z.strictObject({
    locale: LocaleTagSchema,
    headRevision: AdminRevisionSchema.nullable(),
    published: AdminLocaleRevisionSchema.nullable(),
    draft: AdminLocaleRevisionSchema.nullable(),
    effective: AdminLocaleRevisionSchema
  })).min(1).max(100),
  definitions: z.array(AdminPageDefinitionSchema).min(1).max(10_000),
  pages: z.array(AdminPageRevisionSchema).max(10_000),
  sharedContent: z.array(AdminSharedContentRevisionSchema).max(100),
  coverage: z.array(AdminContentCoverageCellSchema).max(100_000),
  readiness: z.strictObject({
    enabledLocaleCount: z.number().int().nonnegative().max(100),
    requiredPageCount: z.number().int().nonnegative().max(10_000),
    readyCellCount: z.number().int().nonnegative().max(100_000),
    missingCellCount: z.number().int().nonnegative().max(100_000),
    fallbackCellCount: z.number().int().nonnegative().max(100_000)
  })
});

export const AdminContentDiffEntrySchema = z.strictObject({
  scope: z.enum(["locale", "page", "shared"]),
  targetId: z.string().min(1).max(160),
  change: z.enum(["added", "changed", "removed", "unchanged"]),
  beforeRevision: AdminRevisionSchema.nullable(),
  afterRevision: AdminRevisionSchema.nullable(),
  affectedPaths: z.array(z.string().regex(/^\/[A-Za-z0-9/_-]*$/)).max(100)
});

export const AdminContentPublicationViewSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  deployment: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  currentRevision: AdminRevisionSchema.nullable(),
  activeSnapshotId: z.string().regex(/^snap_[a-f0-9]{32}$/).nullable(),
  pendingSnapshotId: z.string().regex(/^snap_[a-f0-9]{32}$/).nullable(),
  propagationState: z.enum(["idle", "propagating", "propagated", "propagation_failed"]),
  draftCount: z.number().int().nonnegative().max(100_000),
  readyPageCount: z.number().int().nonnegative().max(10_000),
  blockers: z.array(z.enum([
    "default_locale_not_ready", "default_homepage_not_ready", "locale_not_ready",
    "required_page_missing", "shared_content_missing", "validation_failed", "publication_in_progress"
  ])).max(100),
  affectedPaths: z.array(z.string().regex(/^\/[A-Za-z0-9/_-]*$/)).max(10_000),
  diff: z.array(AdminContentDiffEntrySchema).max(20_000),
  rollbackCandidates: z.array(z.strictObject({
    revision: AdminRevisionSchema,
    snapshotId: z.string().regex(/^snap_[a-f0-9]{32}$/),
    generatedAt: z.iso.datetime({ offset: true })
  })).max(20)
});

const PublicationCommandBaseSchema = z.strictObject({
  deployment: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  expectedRevision: AdminRevisionSchema.nullable(),
  reason: AdminReasonSchema,
  confirmation: z.string().min(1).max(64),
  idempotencyKey: IdempotencyKeySchema
});

export const AdminContentPublishCommandSchema = PublicationCommandBaseSchema.superRefine((command, context) => {
  if (command.confirmation !== command.deployment) context.addIssue({ code: "custom", message: "Publication confirmation must match the deployment.", path: ["confirmation"] });
});

export const AdminContentRollbackCommandSchema = PublicationCommandBaseSchema.extend({
  expectedRevision: AdminRevisionSchema,
  targetRevision: AdminRevisionSchema
}).superRefine((command, context) => {
  if (command.confirmation !== command.deployment) context.addIssue({ code: "custom", message: "Rollback confirmation must match the deployment.", path: ["confirmation"] });
  if (command.targetRevision === command.expectedRevision) context.addIssue({ code: "custom", message: "Rollback must target an older snapshot.", path: ["targetRevision"] });
});

export const AdminContentRetryPropagationCommandSchema = PublicationCommandBaseSchema.extend({
  expectedRevision: AdminRevisionSchema,
  snapshotId: z.string().regex(/^snap_[a-f0-9]{32}$/)
}).superRefine((command, context) => {
  if (command.confirmation !== command.deployment) context.addIssue({ code: "custom", message: "Retry confirmation must match the deployment.", path: ["confirmation"] });
});

export type AdminPageDefinition = z.infer<typeof AdminPageDefinitionSchema>;
export type AdminLocaleDraftCommand = z.infer<typeof AdminLocaleDraftCommandSchema>;
export type AdminLocaleDiscardCommand = z.infer<typeof AdminLocaleDiscardCommandSchema>;
export type AdminPageDraftCommand = z.infer<typeof AdminPageDraftCommandSchema>;
export type AdminPageDiscardCommand = z.infer<typeof AdminPageDiscardCommandSchema>;
export type AdminSharedContentDraftCommand = z.infer<typeof AdminSharedContentDraftCommandSchema>;
export type AdminContentManagementView = z.infer<typeof AdminContentManagementViewSchema>;
export type AdminContentPublicationView = z.infer<typeof AdminContentPublicationViewSchema>;
export type AdminContentPublishCommand = z.infer<typeof AdminContentPublishCommandSchema>;
export type AdminContentRollbackCommand = z.infer<typeof AdminContentRollbackCommandSchema>;
export type AdminContentRetryPropagationCommand = z.infer<typeof AdminContentRetryPropagationCommandSchema>;
