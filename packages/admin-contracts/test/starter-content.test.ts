import { describe, expect, it } from "vitest";
import {
  AdminPageDraftCommandSchema,
  AdminSharedContentSchema,
  STARTER_LOCALES,
  starterPageRecords,
  starterSharedRecords
} from "../src";

describe("starter content", () => {
  it("provides a complete bilingual structured set without public index leakage", () => {
    const pages = starterPageRecords();
    expect(STARTER_LOCALES).toEqual(["en", "zh-CN"]);
    expect(pages).toHaveLength(14);
    expect(pages.filter((page) => page.seo.indexable)).toHaveLength(2);
    expect(pages.filter((page) => page.pageId === "page_home" && page.seo.indexable && page.seo.includeInSitemap)).toHaveLength(2);
    expect(pages.filter((page) => page.pageId === "page_home" && page.seo.includeInSitemap)).toHaveLength(2);
    for (const page of pages) {
      expect(AdminPageDraftCommandSchema.parse({
        ...page,
        state: "ready",
        expectedRevision: null,
        reason: "Initialize the reviewed bilingual starter content set.",
        confirmation: `${page.pageId}/${page.locale}`,
        idempotencyKey: `starter_${page.locale}_${page.pageId}`
      })).toMatchObject({ pageId: page.pageId, locale: page.locale, state: "ready" });
    }
  });

  it("keeps integrations disabled and shared content safe", () => {
    const shared = starterSharedRecords();
    expect(shared).toHaveLength(2);
    for (const entry of shared) {
      expect(AdminSharedContentSchema.parse(entry.content).siteIntegrations).toEqual({
        googleAnalyticsMeasurementId: null,
        googleAdsensePublisherId: null
      });
      expect(entry.content.legalNoticeMarkdown).not.toMatch(/[<>]|https?:\/\//i);
    }
  });
});
