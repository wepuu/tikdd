import { describe, expect, it } from "vitest";
import { deriveGrowthReadiness } from "../lib/growth-model";

const base = {
  content: {
    locales: [
      { locale: "en", effective: { enabled: true } },
      { locale: "zh-CN", effective: { enabled: true } }
    ],
    definitions: [],
    pages: [],
    sharedContent: [],
    coverage: [
      { pageId: "page_x", locale: "en", status: "published" },
      { pageId: "page_x", locale: "zh-CN", status: "ready" },
      { pageId: "page_instagram", locale: "en", status: "published" },
      { pageId: "page_instagram", locale: "zh-CN", status: "missing" }
    ],
    readiness: { enabledLocaleCount: 2, readyCellCount: 3, missingCellCount: 1, fallbackCellCount: 0, requiredPageCount: 2 }
  },
  publication: { currentRevision: 4, propagationState: "propagated" },
  seo: {
    blockerCount: 0,
    passports: [
      { pageId: "page_x", locale: "en", canonicalPath: "/en/x-downloader", indexableEligible: false, sitemapEligible: false },
      { pageId: "page_x", locale: "zh-CN", canonicalPath: "/zh-CN/x-downloader", indexableEligible: false, sitemapEligible: false },
      { pageId: "page_instagram", locale: "en", canonicalPath: "/en/instagram-downloader", indexableEligible: false, sitemapEligible: false },
      { pageId: "page_instagram", locale: "zh-CN", canonicalPath: "/zh-CN/instagram-downloader", indexableEligible: false, sitemapEligible: false }
    ]
  },
  settings: { siteIntegrations: { googleAnalyticsMeasurementId: "G-TEST1234", googleAdsensePublisherId: null } }
} as unknown as Parameters<typeof deriveGrowthReadiness>[0];

describe("growth readiness model", () => {
  it("summarizes platform coverage without inventing traffic metrics", () => {
    const model = deriveGrowthReadiness(base);
    expect(model.status).toBe("partial");
    expect(model.currentRevision).toBe(4);
    expect(model.analytics).toBe("configured");
    expect(model.adsense).toBe("missing");
    expect(model.platformPages.map(({ platform }) => platform)).toEqual(["x", "instagram"]);
    expect(model.platformPages[0]?.noindexLocales).toBe(2);
    expect(model.platformPages[1]?.readyLocales).toBe(1);
    expect(model.blockers).toContain("content_gaps");
  });

  it("fails closed when one read model is unavailable", () => {
    const model = deriveGrowthReadiness({ ...base, seo: null });
    expect(model.status).toBe("unavailable");
    expect(model.blockers).toEqual(["read_models_unavailable"]);
    expect(model.platformPages).toEqual([]);
  });
});
