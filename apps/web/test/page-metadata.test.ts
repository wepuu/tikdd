import { describe, expect, it } from "vitest";
import { pageMetadataCopy } from "../lib/page-metadata";
import { alternatesForPage } from "../lib/content-presentation";
import { BUNDLED_PUBLIC_CONTENT_SNAPSHOT } from "../lib/seed-snapshot";

describe("published page metadata", () => {
  it.each([
    ["en", ["X", "Instagram"]],
    ["zh-CN", ["X", "Instagram"]]
  ] as const)("describes both live Betas for the %s homepage", (locale, platforms) => {
    const page = BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.find(
      (candidate) => candidate.locale === locale && candidate.pageType === "homepage"
    );
    expect(page).toBeDefined();
    const metadata = pageMetadataCopy(BUNDLED_PUBLIC_CONTENT_SNAPSHOT, page!);
    for (const platform of platforms) {
      expect(metadata.title).toContain(platform);
      expect(metadata.description).toContain(platform);
      expect(metadata.socialTitle).toContain(platform);
      expect(metadata.socialDescription).toContain(platform);
    }
  });

  it("keeps the noindex Instagram review page out of hreflang", () => {
    const page = BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.find(
      (candidate) => candidate.pageId === "page_instagram" && candidate.locale === "en"
    );
    expect(page).toBeDefined();
    expect(page?.seo.indexable).toBe(false);
    expect(alternatesForPage(BUNDLED_PUBLIC_CONTENT_SNAPSHOT, page!)).toEqual({});
  });
});
