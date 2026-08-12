import { PlatformIdSchema, RegionIdSchema } from "@tikdd/contracts";
import { z } from "zod";
import {
  AdminActorSubjectSchema,
  AdminDeploymentIdSchema,
  AdminReasonSchema,
  AdminRevisionSchema,
  AdminSchemaVersionSchema,
  AdminTimestampSchema
} from "./common";

function isCanonicalLocale(value: string): boolean {
  try {
    return Intl.getCanonicalLocales(value)[0] === value;
  } catch {
    return false;
  }
}

export const LocaleTagSchema = z
  .string()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/)
  .refine(isCanonicalLocale, "Locale tags must be canonical BCP 47 values.");

export const LocalizedPathSchema = z
  .string()
  .min(1)
  .max(240)
  .regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/);

export const ApprovedAssetIdSchema = z
  .string()
  .min(7)
  .max(100)
  .regex(/^asset_[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

export const SafeMarkdownSchema = z
  .string()
  .trim()
  .min(1)
  .max(20_000)
  .refine((value) => !/[<>]/.test(value), "Raw HTML is not allowed.")
  .refine((value) => !/!\[[^\]]*\]\s*\(/.test(value), "Inline images are not allowed.")
  .refine((value) => !/https?:\/\//i.test(value), "Absolute remote links are not allowed.")
  .refine((value) => !/(?:javascript|data|vbscript):/i.test(value), "Unsafe URI schemes are not allowed.");

const ShortTextSchema = z.string().trim().min(1).max(200);
const LongTextSchema = z.string().trim().min(1).max(1_000);
const StepSchema = z.strictObject({ title: ShortTextSchema, description: LongTextSchema });
const FaqItemSchema = z.strictObject({ question: ShortTextSchema, answerMarkdown: SafeMarkdownSchema });
const SectionSchema = z.strictObject({ id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), heading: ShortTextSchema, bodyMarkdown: SafeMarkdownSchema });

export const HomepageContentSchema = z.strictObject({
  template: z.literal("homepage"),
  heroTitle: ShortTextSchema,
  heroSubtitle: LongTextSchema,
  inputLabel: ShortTextSchema,
  inputPlaceholder: z.string().trim().min(1).max(240),
  primaryActionLabel: z.string().trim().min(1).max(80),
  supportedPlatformsTitle: ShortTextSchema,
  howItWorksTitle: ShortTextSchema,
  howItWorksSteps: z.array(StepSchema).min(2).max(6),
  faqTitle: ShortTextSchema,
  faqItems: z.array(FaqItemSchema).min(1).max(20)
});

export const PlatformPageContentSchema = z.strictObject({
  template: z.literal("platform"),
  eyebrow: z.string().trim().min(1).max(80),
  title: ShortTextSchema,
  introduction: LongTextSchema,
  limitationsMarkdown: SafeMarkdownSchema,
  howToSteps: z.array(StepSchema).min(2).max(8),
  faqItems: z.array(FaqItemSchema).max(20)
});

export const GuidePageContentSchema = z.strictObject({
  template: z.literal("guide"),
  title: ShortTextSchema,
  introduction: LongTextSchema,
  sections: z.array(SectionSchema).min(1).max(30)
});

export const FaqPageContentSchema = z.strictObject({
  template: z.literal("faq"),
  title: ShortTextSchema,
  introduction: LongTextSchema,
  items: z.array(FaqItemSchema).min(1).max(50)
});

export const LegalPageContentSchema = z.strictObject({
  template: z.literal("legal"),
  title: ShortTextSchema,
  summary: LongTextSchema,
  sections: z.array(SectionSchema).min(1).max(40)
});

export const AdminPageContentSchema = z.discriminatedUnion("template", [
  HomepageContentSchema,
  PlatformPageContentSchema,
  GuidePageContentSchema,
  FaqPageContentSchema,
  LegalPageContentSchema
]);

export const AdminSeoFieldsSchema = z
  .strictObject({
    localPath: LocalizedPathSchema,
    searchTitle: z.string().trim().min(10).max(70),
    searchDescription: z.string().trim().min(40).max(180),
    socialTitle: z.string().trim().min(1).max(100).nullable(),
    socialDescription: z.string().trim().min(1).max(240).nullable(),
    socialImageAssetId: ApprovedAssetIdSchema.nullable(),
    indexable: z.boolean(),
    includeInSitemap: z.boolean(),
    redirectFrom: z.array(LocalizedPathSchema).max(20)
  })
  .superRefine((seo, context) => {
    if (!seo.indexable && seo.includeInSitemap) {
      context.addIssue({ code: "custom", message: "A noindex page cannot enter the sitemap.", path: ["includeInSitemap"] });
    }
    if (new Set(seo.redirectFrom).size !== seo.redirectFrom.length) {
      context.addIssue({ code: "custom", message: "Redirect sources must be unique.", path: ["redirectFrom"] });
    }
    if (seo.redirectFrom.includes(seo.localPath)) {
      context.addIssue({ code: "custom", message: "A page cannot redirect from its current path.", path: ["redirectFrom"] });
    }
  });

export const AdminLocaleRevisionSchema = z
  .strictObject({
    schemaVersion: AdminSchemaVersionSchema,
    locale: LocaleTagSchema,
    revision: AdminRevisionSchema,
    displayName: z.string().trim().min(1).max(100),
    direction: z.enum(["ltr", "rtl"]),
    fallbackLocale: LocaleTagSchema.nullable(),
    enabled: z.boolean(),
    isDefault: z.boolean(),
    state: z.enum(["draft", "ready", "published", "archived"]),
    reason: AdminReasonSchema,
    actorSubject: AdminActorSubjectSchema,
    createdAt: AdminTimestampSchema
  })
  .superRefine((locale, context) => {
    if (locale.fallbackLocale === locale.locale) {
      context.addIssue({ code: "custom", message: "A locale cannot fall back to itself.", path: ["fallbackLocale"] });
    }
    if (locale.isDefault && locale.fallbackLocale !== null) {
      context.addIssue({ code: "custom", message: "The default locale cannot have a fallback.", path: ["fallbackLocale"] });
    }
    if (locale.state === "published" && !locale.enabled) {
      context.addIssue({ code: "custom", message: "A published locale must be enabled.", path: ["enabled"] });
    }
  });

export const AdminPageRevisionSchema = z
  .strictObject({
    schemaVersion: AdminSchemaVersionSchema,
    pageId: z.string().min(5).max(120).regex(/^page_[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
    locale: LocaleTagSchema,
    revision: AdminRevisionSchema,
    pageType: z.enum(["homepage", "platform", "guide", "faq", "legal"]),
    platform: PlatformIdSchema.nullable(),
    state: z.enum(["draft", "ready", "published", "archived"]),
    content: AdminPageContentSchema,
    seo: AdminSeoFieldsSchema,
    reason: AdminReasonSchema,
    actorSubject: AdminActorSubjectSchema,
    createdAt: AdminTimestampSchema
  })
  .superRefine((page, context) => {
    if (page.content.template !== page.pageType) {
      context.addIssue({ code: "custom", message: "Content template must match the page type.", path: ["content", "template"] });
    }
    if ((page.pageType === "platform") !== (page.platform !== null)) {
      context.addIssue({ code: "custom", message: "Only platform pages require a platform slug.", path: ["platform"] });
    }
  });

export const AdminPlatformPresentationRevisionSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  platform: PlatformIdSchema,
  region: RegionIdSchema,
  revision: AdminRevisionSchema,
  publicAvailability: z.enum(["hidden", "preview", "listed", "paused"]),
  pageId: z.string().regex(/^page_[a-z0-9]+(?:[._-][a-z0-9]+)*$/).nullable(),
  reason: AdminReasonSchema,
  actorSubject: AdminActorSubjectSchema,
  createdAt: AdminTimestampSchema
});

export const PublishedLocaleSchema = z.strictObject({
  locale: LocaleTagSchema,
  displayName: z.string().trim().min(1).max(100),
  direction: z.enum(["ltr", "rtl"]),
  fallbackLocale: LocaleTagSchema.nullable(),
  isDefault: z.boolean()
});

export const PublishedPageSchema = z.strictObject({
  pageId: z.string().regex(/^page_[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
  locale: LocaleTagSchema,
  pageType: z.enum(["homepage", "platform", "guide", "faq", "legal"]),
  platform: PlatformIdSchema.nullable(),
  content: AdminPageContentSchema,
  seo: AdminSeoFieldsSchema
});

export const PublishedSharedContentSchema = z.strictObject({
  locale: LocaleTagSchema,
  navigationLabel: z.string().trim().min(1).max(80),
  footerTagline: z.string().trim().min(1).max(240),
  legalNoticeMarkdown: SafeMarkdownSchema
});

export const PublishedContentSnapshotSchema = z
  .strictObject({
    schemaVersion: AdminSchemaVersionSchema,
    snapshotId: z.string().regex(/^snap_[a-f0-9]{32}$/),
    deployment: AdminDeploymentIdSchema,
    revision: AdminRevisionSchema,
    previousSnapshotId: z.string().regex(/^snap_[a-f0-9]{32}$/).nullable(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    locales: z.array(PublishedLocaleSchema).min(1).max(100),
    pages: z.array(PublishedPageSchema).min(1).max(10_000),
    sharedContent: z.array(PublishedSharedContentSchema).max(100).default([]),
    generatedAt: AdminTimestampSchema
  })
  .superRefine((snapshot, context) => {
    const localeTags = snapshot.locales.map(({ locale }) => locale);
    if (new Set(localeTags).size !== localeTags.length) {
      context.addIssue({ code: "custom", message: "Published locale tags must be unique.", path: ["locales"] });
    }
    if (snapshot.locales.filter(({ isDefault }) => isDefault).length !== 1) {
      context.addIssue({ code: "custom", message: "Exactly one published locale must be the default.", path: ["locales"] });
    }
    const localeSet = new Set(localeTags);
    const sharedLocaleTags = snapshot.sharedContent.map(({ locale }) => locale);
    if (new Set(sharedLocaleTags).size !== sharedLocaleTags.length || sharedLocaleTags.some((locale) => !localeSet.has(locale))) {
      context.addIssue({ code: "custom", message: "Published shared content must use unique snapshot locales.", path: ["sharedContent"] });
    }
    const pageKeys = new Set<string>();
    const paths = new Set<string>();
    const redirects = new Set<string>();
    for (const page of snapshot.pages) {
      const key = `${page.pageId}:${page.locale}`;
      if (pageKeys.has(key)) {
        context.addIssue({ code: "custom", message: "Published page/locale pairs must be unique.", path: ["pages"] });
      }
      pageKeys.add(key);
      if (!localeSet.has(page.locale)) {
        context.addIssue({ code: "custom", message: "Every published page locale must exist in the snapshot.", path: ["pages"] });
      }
      const localizedPath = `${page.locale}:${page.seo.localPath}`;
      if (paths.has(localizedPath)) {
        context.addIssue({ code: "custom", message: "Localized published paths must be unique.", path: ["pages"] });
      }
      paths.add(localizedPath);
      for (const redirect of page.seo.redirectFrom) {
        const localizedRedirect = `${page.locale}:${redirect}`;
        if (redirects.has(localizedRedirect) || paths.has(localizedRedirect)) {
          context.addIssue({ code: "custom", message: "Redirect sources cannot collide with published paths.", path: ["pages"] });
        }
        redirects.add(localizedRedirect);
      }
    }
  });

export const AdminLocaleListSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  generatedAt: AdminTimestampSchema,
  channel: z.enum(["draft", "published"]),
  locales: z.array(AdminLocaleRevisionSchema).max(100)
});

export const AdminPageListSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  generatedAt: AdminTimestampSchema,
  channel: z.enum(["draft", "published"]),
  pages: z.array(AdminPageRevisionSchema).max(10_000)
});

export const AdminSeoPageSummarySchema = z.strictObject({
  pageId: z.string().regex(/^page_[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
  locale: LocaleTagSchema,
  pageType: z.enum(["homepage", "platform", "guide", "faq", "legal"]),
  state: z.enum(["draft", "ready", "published", "archived"]),
  localPath: LocalizedPathSchema,
  indexable: z.boolean(),
  includeInSitemap: z.boolean(),
  blockerCount: z.number().int().nonnegative().max(100)
});

export const AdminSeoOverviewSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  generatedAt: AdminTimestampSchema,
  channel: z.enum(["draft", "published"]),
  indexablePageCount: z.number().int().nonnegative().max(10_000),
  sitemapPageCount: z.number().int().nonnegative().max(10_000),
  blockerCount: z.number().int().nonnegative().max(100_000),
  pages: z.array(AdminSeoPageSummarySchema).max(10_000)
});

export function validateLocaleRegistry(input: readonly unknown[]): AdminLocaleRevision[] {
  const locales = input.map((locale) => AdminLocaleRevisionSchema.parse(locale));
  const byTag = new Map(locales.map((locale) => [locale.locale, locale]));
  if (byTag.size !== locales.length) {
    throw new Error("Locale tags must be unique.");
  }
  if (locales.filter(({ isDefault }) => isDefault).length !== 1) {
    throw new Error("Exactly one locale must be the default.");
  }
  for (const locale of locales) {
    if (locale.fallbackLocale !== null && !byTag.has(locale.fallbackLocale)) {
      throw new Error(`Missing fallback locale: ${locale.fallbackLocale}`);
    }
    const visited = new Set<string>([locale.locale]);
    let current = locale;
    while (current.fallbackLocale !== null) {
      if (visited.has(current.fallbackLocale)) {
        throw new Error(`Locale fallback cycle detected at ${current.fallbackLocale}`);
      }
      visited.add(current.fallbackLocale);
      const next = byTag.get(current.fallbackLocale);
      if (!next) break;
      current = next;
    }
  }
  return locales;
}

export type AdminLocaleRevision = z.infer<typeof AdminLocaleRevisionSchema>;
export type AdminPageRevision = z.infer<typeof AdminPageRevisionSchema>;
export type AdminPageContent = z.infer<typeof AdminPageContentSchema>;
export type AdminPlatformPresentationRevision = z.infer<typeof AdminPlatformPresentationRevisionSchema>;
export type PublishedContentSnapshot = z.infer<typeof PublishedContentSnapshotSchema>;
export type AdminLocaleList = z.infer<typeof AdminLocaleListSchema>;
export type AdminPageList = z.infer<typeof AdminPageListSchema>;
export type AdminSeoOverview = z.infer<typeof AdminSeoOverviewSchema>;
