import { describe, expect, it } from "vitest";
import {
  AdminPageDraftCommandSchema,
  GeoContentSchema,
  PublishedContentSnapshotSchema,
  deriveSeoTechnicalView,
  isGeoContentReady
} from "../src";
import { ADMIN_PUBLISHED_SNAPSHOT_FIXTURE } from "../src/fixtures";

const reviewedGeo = {
  directAnswer: "TikDD resolves eligible public pages and returns the formats available for delivery.",
  reviewStatus: "reviewed" as const,
  reviewedAt: "2026-09-08T10:00:00.000Z",
  sourceRefs: ["tikdd-workflow" as const]
};

const platform = {
  ...ADMIN_PUBLISHED_SNAPSHOT_FIXTURE.pages[0]!,
  pageId: "page_x",
  pageType: "platform" as const,
  platform: "x",
  content: {
    template: "platform" as const,
    eyebrow: "X Beta",
    title: "X video downloader Beta",
    introduction: "Resolve a public X post and choose an available format through TikDD.",
    limitationsMarkdown: "Public links only. Private or restricted posts may not resolve.",
    howToSteps: [
      { title: "Paste a link", description: "Copy a public X post link." },
      { title: "Choose a format", description: "Select an available format and request delivery." }
    ],
    faqItems: [],
    geo: reviewedGeo
  },
  seo: { ...ADMIN_PUBLISHED_SNAPSHOT_FIXTURE.pages[0]!.seo, localPath: "/x" }
};

describe("bounded GEO content", () => {
  it("keeps legacy platform snapshots readable without a GEO object", () => {
    const legacy = { ...platform, content: { ...platform.content, geo: undefined } };
    const snapshot = PublishedContentSnapshotSchema.parse({
      ...ADMIN_PUBLISHED_SNAPSHOT_FIXTURE,
      pages: [legacy]
    });
    expect(snapshot.pages[0]?.content.template).toBe("platform");
    expect(snapshot.pages[0]?.content.template === "platform" ? snapshot.pages[0].content.geo : null).toBeNull();
  });

  it("accepts reviewed content only with a timestamp and approved source", () => {
    expect(isGeoContentReady(reviewedGeo)).toBe(true);
    expect(() => GeoContentSchema.parse({ ...reviewedGeo, sourceRefs: ["unknown-source"] })).toThrow();
    expect(() => GeoContentSchema.parse({ ...reviewedGeo, directAnswer: "Use https://evil.example for the answer." })).toThrow();
    expect(() => GeoContentSchema.parse({ ...reviewedGeo, reviewStatus: "draft", reviewedAt: reviewedGeo.reviewedAt })).toThrow();
    expect(isGeoContentReady({ ...reviewedGeo, reviewStatus: "draft", reviewedAt: null })).toBe(false);
  });

  it("blocks indexing when a platform page is not reviewed", () => {
    const unreviewed = {
      ...platform,
      content: {
        ...platform.content,
        geo: { directAnswer: "This is a sufficiently long direct answer for a draft page.", reviewStatus: "draft" as const, reviewedAt: null, sourceRefs: [] }
      },
      seo: { ...platform.seo, indexable: true, includeInSitemap: true }
    };
    const snapshot = PublishedContentSnapshotSchema.parse({ ...ADMIN_PUBLISHED_SNAPSHOT_FIXTURE, pages: [unreviewed] });
    const view = deriveSeoTechnicalView({ snapshot, eligiblePlatforms: ["x"], generatedAt: "2026-09-08T10:00:00.000Z" });
    expect(view.passports[0]?.blockers).toContain("geo_content_not_ready");
    expect(view.passports[0]?.indexableEligible).toBe(false);
  });

  it("allows an eligible platform page after reviewed GEO content is present", () => {
    const snapshot = PublishedContentSnapshotSchema.parse({
      ...ADMIN_PUBLISHED_SNAPSHOT_FIXTURE,
      pages: [{ ...platform, seo: { ...platform.seo, indexable: true, includeInSitemap: true } }]
    });
    const view = deriveSeoTechnicalView({ snapshot, eligiblePlatforms: ["x"], generatedAt: "2026-09-08T10:00:00.000Z" });
    expect(view.passports[0]).toMatchObject({ blockers: [], indexableEligible: true, sitemapEligible: true });
  });

  it("round-trips the GEO fields through the Admin page command", () => {
    const command = {
      pageId: "page_x",
      locale: "en",
      pageType: "platform" as const,
      platform: "x",
      state: "ready" as const,
      content: platform.content,
      seo: { ...platform.seo, indexable: false, includeInSitemap: false },
      expectedRevision: 1,
      reason: "Save the reviewed GEO answer.",
      confirmation: "page_x/en",
      idempotencyKey: "abcdefghijklmnop"
    };
    expect(AdminPageDraftCommandSchema.parse(command).content).toMatchObject({ geo: reviewedGeo });
  });
});
