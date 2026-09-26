import {
  PublishedContentSnapshotSchema,
  STARTER_LOCALES,
  STARTER_LOCALE_DEFINITIONS,
  starterPages,
  starterSharedContent,
  type PublishedContentSnapshot
} from "@tikdd/admin-contracts";

/**
 * Last-known-good Web fallback. The same reviewed starter content is used by the Admin bootstrap
 * action, so a database outage cannot silently present a different first-release copy.
 */
export const BUNDLED_PUBLIC_CONTENT_SNAPSHOT: PublishedContentSnapshot = PublishedContentSnapshotSchema.parse({
  schemaVersion: "1",
  snapshotId: "snap_00000000000000000000000000000001",
  deployment: "tikdd",
  revision: 1,
  previousSnapshotId: null,
  contentHash: "0".repeat(64),
  locales: STARTER_LOCALES.map((locale) => ({ locale, ...STARTER_LOCALE_DEFINITIONS[locale] })),
  pages: STARTER_LOCALES.flatMap((locale) => starterPages(locale).map(({ pageId, pageType, platform, content, seo }) => ({ pageId, locale, pageType, platform, content, seo }))),
  sharedContent: STARTER_LOCALES.map((locale) => {
    const { siteIntegrations: _siteIntegrations, ...localized } = starterSharedContent(locale);
    return { locale, ...localized };
  }),
  siteIntegrations: { googleAnalyticsMeasurementId: null, googleAdsensePublisherId: null },
  generatedAt: "2026-09-26T00:00:00.000Z"
});
