import { describe, expect, it } from "vitest";
import { GEO_SOURCE_LINKS, geoSourceLabel } from "../lib/geo-content";
import { BUNDLED_PUBLIC_CONTENT_SNAPSHOT } from "../lib/seed-snapshot";

describe("Web GEO source registry", () => {
  it("contains only fixed reviewed source links", () => {
    expect(Object.keys(GEO_SOURCE_LINKS).sort()).toEqual([
      "instagram-public-content",
      "tikdd-workflow",
      "x-public-content"
    ]);
    for (const source of Object.values(GEO_SOURCE_LINKS)) {
      expect(new URL(source.href).protocol).toBe("https:");
    }
  });

  it("localizes source labels without accepting caller-supplied URLs", () => {
    expect(geoSourceLabel("instagram-public-content", "zh-CN")).toBe("Instagram 公开内容说明");
    expect(geoSourceLabel("tikdd-workflow", "en")).toBe("TikDD workflow");
  });

  it("ships bounded bilingual Instagram GEO inputs without claiming editorial review", () => {
    const pages = BUNDLED_PUBLIC_CONTENT_SNAPSHOT.pages.filter((page) => page.platform === "instagram");
    expect(pages).toHaveLength(2);
    for (const page of pages) {
      expect(page.content.template).toBe("platform");
      if (page.content.template !== "platform") continue;
      expect(page.content.geo).toMatchObject({
        reviewStatus: "draft",
        reviewedAt: null,
        sourceRefs: ["tikdd-workflow", "instagram-public-content"]
      });
      expect(page.content.geo?.directAnswer.length).toBeGreaterThanOrEqual(20);
      expect(page.content.geo?.directAnswer).not.toMatch(/https?:\/\//i);
    }
  });
});
