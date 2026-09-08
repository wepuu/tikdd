import { describe, expect, it } from "vitest";
import { GEO_SOURCE_LINKS, geoSourceLabel } from "../lib/geo-content";

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
});
