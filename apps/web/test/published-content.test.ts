import { describe, expect, it } from "vitest";
import type { PublicContentSource } from "../lib/published-content";
import { PublishedContentLoader, findPublishedPage, resetPublishedContentStateForTest } from "../lib/published-content";
import { BUNDLED_PUBLIC_CONTENT_SNAPSHOT } from "../lib/seed-snapshot";

describe("public published-content loader", () => {
  it("bundles a reviewed multilingual Instagram page in the public index set", () => {
    const instagramPages = BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.filter((page) => page.platform === "instagram");
    expect(instagramPages.map((page) => page.locale)).toEqual(BUNDLED_PUBLIC_CONTENT_SNAPSHOT.locales.map(({ locale }) => locale));
    expect(instagramPages.every((page) => page.pageType === "platform" && page.seo.indexable && page.seo.includeInSitemap)).toBe(true);
    expect(instagramPages.every((page) => page.content.template === "platform" && page.content.howToSteps.length >= 2)).toBe(true);
    expect(instagramPages.every((page) => page.content.template === "platform" && page.content.geo?.reviewStatus === "reviewed")).toBe(true);
    expect(BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.filter((page) => page.seo.includeInSitemap)).toHaveLength(72);
  });

  it("bundles the X Beta landing page with the same route-gated index intent", () => {
    const xPages = BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.filter((page) => page.platform === "x");
    expect(xPages.map((page) => page.locale)).toEqual(BUNDLED_PUBLIC_CONTENT_SNAPSHOT.locales.map(({ locale }) => locale));
    expect(xPages.every((page) => page.pageType === "platform" && page.seo.indexable && page.seo.includeInSitemap)).toBe(true);
    expect(xPages.every((page) => page.content.template === "platform" && page.content.howToSteps.length >= 2)).toBe(true);
    expect(xPages.every((page) => page.content.template === "platform" && page.content.geo?.reviewStatus === "reviewed")).toBe(true);
  });

  it("bundles the TikTok stable landing page in the public index set", () => {
    const tiktokPages = BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.filter((page) => page.platform === "tiktok");
    expect(tiktokPages.map((page) => page.locale)).toEqual(BUNDLED_PUBLIC_CONTENT_SNAPSHOT.locales.map(({ locale }) => locale));
    expect(tiktokPages.every((page) => page.pageType === "platform" && page.seo.indexable && page.seo.includeInSitemap)).toBe(true);
    expect(tiktokPages.every((page) => page.content.template === "platform" && page.content.eyebrow.includes("TikTok") && page.content.geo?.reviewStatus === "reviewed")).toBe(true);
  });

  it("bundles the remaining available Beta platforms as multilingual index pages", () => {
    for (const platform of ["facebook", "vimeo", "pinterest", "xhamster"] as const) {
      const pages = BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.filter((page) => page.platform === platform);
      expect(pages.map((page) => page.locale)).toEqual(BUNDLED_PUBLIC_CONTENT_SNAPSHOT.locales.map(({ locale }) => locale));
      expect(pages.every((page) => page.pageType === "platform" && page.seo.indexable && page.seo.includeInSitemap)).toBe(true);
      expect(pages.every((page) => page.content.template === "platform" && page.content.geo?.reviewStatus === "reviewed")).toBe(true);
    }
    expect(BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.filter((page) => page.seo.includeInSitemap)).toHaveLength(72);
  });

  it("keeps xHamster off homepage promotion while publishing its dedicated search page", () => {
    const pages = BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.filter((page) => page.platform === "xhamster");
    expect(pages.map((page) => page.locale)).toEqual(BUNDLED_PUBLIC_CONTENT_SNAPSHOT.locales.map(({ locale }) => locale));
    expect(pages.every((page) => page.seo.indexable && page.seo.includeInSitemap)).toBe(true);
    expect(pages.every((page) => page.seo.localPath === "/xhamster-downloader")).toBe(true);
  });

  it("uses only a runtime-validated active snapshot", async () => {
    resetPublishedContentStateForTest();
    const source: PublicContentSource = { loadActive: async () => BUNDLED_PUBLIC_CONTENT_SNAPSHOT, loadCandidate: async () => null };
    const snapshot = await new PublishedContentLoader(source).load();
    expect(snapshot.snapshotId).toBe(BUNDLED_PUBLIC_CONTENT_SNAPSHOT.snapshotId);
    expect(findPublishedPage(snapshot, "en", [])?.content.template).toBe("homepage");
  });

  it("keeps the last known-good snapshot during a content-store outage", async () => {
    resetPublishedContentStateForTest();
    let available = true;
    const source: PublicContentSource = {
      loadActive: async () => { if (!available) throw new Error("offline"); return BUNDLED_PUBLIC_CONTENT_SNAPSHOT; },
      loadCandidate: async () => null
    };
    const loader = new PublishedContentLoader(source);
    const first = await loader.load();
    available = false;
    expect(await loader.load()).toBe(first);
    expect(loader.health().source).toBe("database");
  });

  it("falls back to the bundled nine-locale seed on a cold outage", async () => {
    resetPublishedContentStateForTest();
    const source: PublicContentSource = { loadActive: async () => { throw new Error("offline"); }, loadCandidate: async () => null };
    const loader = new PublishedContentLoader(source);
    const snapshot = await loader.load();
    expect(snapshot.locales.map(({ locale }) => locale)).toEqual(["en", "zh-CN", "es", "fr", "de", "it", "tr", "pl", "ja"]);
    expect(loader.health()).toMatchObject({ status: "seed", source: "bundled-seed" });
  });

  it("preflights a named candidate without making it active", async () => {
    resetPublishedContentStateForTest();
    const previousPublicDeployment = process.env.PUBLIC_CONTENT_DEPLOYMENT_ID;
    const previousDeployment = process.env.TIKDD_DEPLOYMENT_ID;
    process.env.PUBLIC_CONTENT_DEPLOYMENT_ID = "  ";
    process.env.TIKDD_DEPLOYMENT_ID = "";
    const candidate = { ...BUNDLED_PUBLIC_CONTENT_SNAPSHOT, snapshotId: `snap_${"1".repeat(32)}`, revision: 2 };
    const source: PublicContentSource = { loadActive: async () => BUNDLED_PUBLIC_CONTENT_SNAPSHOT, loadCandidate: async () => candidate };
    const loader = new PublishedContentLoader(source);
    try {
      expect((await loader.acknowledge(candidate.snapshotId)).snapshotId).toBe(candidate.snapshotId);
      expect((await loader.load()).snapshotId).toBe(BUNDLED_PUBLIC_CONTENT_SNAPSHOT.snapshotId);
    } finally {
      if (previousPublicDeployment === undefined) delete process.env.PUBLIC_CONTENT_DEPLOYMENT_ID;
      else process.env.PUBLIC_CONTENT_DEPLOYMENT_ID = previousPublicDeployment;
      if (previousDeployment === undefined) delete process.env.TIKDD_DEPLOYMENT_ID;
      else process.env.TIKDD_DEPLOYMENT_ID = previousDeployment;
    }
  });
});
