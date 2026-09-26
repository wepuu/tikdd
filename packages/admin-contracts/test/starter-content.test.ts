import { describe, expect, it } from "vitest";
import {
  AdminPageDraftCommandSchema,
  AdminSharedContentSchema,
  STARTER_LOCALES,
  starterPageRecords,
  starterSharedRecords
} from "../src";

describe("starter content", () => {
  it("provides a complete nine-locale set with every available platform page indexed", () => {
    const pages = starterPageRecords();
    expect(STARTER_LOCALES).toEqual(["en", "zh-CN", "es", "fr", "de", "it", "tr", "pl", "ja"]);
    expect(pages).toHaveLength(108);
    expect(pages.filter((page) => page.seo.indexable)).toHaveLength(72);
    expect(pages.filter((page) => page.pageId === "page_home" && page.seo.indexable && page.seo.includeInSitemap)).toHaveLength(9);
    expect(pages.filter((page) => page.pageType === "platform" && page.seo.indexable && page.seo.includeInSitemap)).toHaveLength(63);
    for (const platform of ["x", "instagram", "tiktok", "facebook", "vimeo", "pinterest", "xhamster"] as const) {
      const localizedPages = pages.filter((page) => page.platform === platform);
      expect(localizedPages.map(({ locale }) => locale)).toEqual(STARTER_LOCALES);
      expect(localizedPages.every((page) => page.content.template === "platform" && page.content.geo?.reviewStatus === "reviewed")).toBe(true);
    }
    for (const page of pages) {
      expect(AdminPageDraftCommandSchema.parse({
        ...page,
        state: "ready",
        expectedRevision: null,
        reason: "Initialize the reviewed multilingual starter content set.",
        confirmation: `${page.pageId}/${page.locale}`,
        idempotencyKey: `starter_${page.locale}_${page.pageId}`
      })).toMatchObject({ pageId: page.pageId, locale: page.locale, state: "ready" });
    }
  });

  it("keeps integrations disabled and shared content safe", () => {
    const shared = starterSharedRecords();
    expect(shared).toHaveLength(9);
    for (const entry of shared) {
      expect(AdminSharedContentSchema.parse(entry.content).siteIntegrations).toEqual({
        googleAnalyticsMeasurementId: null,
        googleAdsensePublisherId: null
      });
      expect(entry.content.legalNoticeMarkdown).not.toMatch(/[<>]|https?:\/\//i);
    }
  });
});
