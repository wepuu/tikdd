import { describe, expect, it } from "vitest";
import { copyForPage } from "../lib/content-presentation";
import { BUNDLED_PUBLIC_CONTENT_SNAPSHOT } from "../lib/seed-snapshot";
import { buildStructuredData, serializeStructuredData } from "../lib/structured-data";

const homepage = BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.find((page) => page.pageType === "homepage" && page.locale === "en")!;
const instagram = BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.find((page) => page.pageId === "page_instagram" && page.locale === "en")!;

describe("published structured data", () => {
  it("builds a localized homepage graph from the visible copy", () => {
    const copy = copyForPage(homepage);
    const document = buildStructuredData({
      page: homepage,
      copy,
      siteName: "TikDD",
      siteUrl: "https://www.tikdd.cc"
    });
    expect(document?.["@context"]).toBe("https://schema.org");
    expect(document?.["@graph"].map((node) => node["@type"])).toEqual(["SoftwareApplication", "FAQPage", "HowTo"]);
    expect(document?.["@graph"][0]?.description).toBe(copy.hero.description);
    const faq = document?.["@graph"].find((node) => node["@type"] === "FAQPage");
    expect(faq?.mainEntity).toHaveLength(3);
    expect(JSON.stringify(faq)).toContain("Which links can I use?");
  });

  it("keeps experimental noindex Instagram pages free of structured data", () => {
    const document = buildStructuredData({
      page: instagram,
      copy: copyForPage(instagram),
      siteName: "TikDD",
      siteUrl: "https://www.tikdd.cc"
    });
    expect(document).toBeNull();
  });

  it("adds breadcrumbs only after an eligible platform page is indexable", () => {
    const eligible = { ...instagram, seo: { ...instagram.seo, indexable: true, includeInSitemap: true } };
    const document = buildStructuredData({
      page: eligible,
      copy: copyForPage(eligible),
      siteName: "TikDD",
      siteUrl: "https://www.tikdd.cc"
    });
    expect(document?.["@graph"].map((node) => node["@type"])).toEqual(["FAQPage", "HowTo", "BreadcrumbList"]);
    expect(JSON.stringify(document)).toContain("https://www.tikdd.cc/en/instagram-downloader");
  });

  it("escapes inline-script terminators without changing the parsed data", () => {
    const serialized = serializeStructuredData({ "@context": "https://schema.org", "@graph": [{ "@type": "Thing", name: "</script><script>alert(1)</script> & safe" }] });
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(serialized).toContain("\\u0026");
  });
});
