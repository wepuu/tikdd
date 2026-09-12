import { describe, expect, it } from "vitest";
import { sitemapEntries } from "../app/sitemap";
import { BUNDLED_PUBLIC_CONTENT_SNAPSHOT } from "../lib/seed-snapshot";

describe("public sitemap", () => {
  it("includes only the homepage and stable TikTok landing pages", () => {
    const entries = sitemapEntries(BUNDLED_PUBLIC_CONTENT_SNAPSHOT, "https://www.tikdd.cc");
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://www.tikdd.cc/en",
      "https://www.tikdd.cc/en/tiktok-downloader",
      "https://www.tikdd.cc/zh-CN",
      "https://www.tikdd.cc/zh-CN/tiktok-downloader"
    ]);
    const tiktok = entries.find((entry) => entry.url === "https://www.tikdd.cc/en/tiktok-downloader");
    expect(tiktok?.alternates?.languages).toMatchObject({
      en: "https://www.tikdd.cc/en/tiktok-downloader",
      "zh-CN": "https://www.tikdd.cc/zh-CN/tiktok-downloader",
      "x-default": "https://www.tikdd.cc/en/tiktok-downloader"
    });
    expect(entries.some((entry) => entry.url.includes("x-downloader"))).toBe(false);
    expect(entries.some((entry) => entry.url.includes("instagram-downloader"))).toBe(false);
  });
});
