import { describe, expect, it } from "vitest";
import { sitemapEntries } from "../app/sitemap";
import { BUNDLED_PUBLIC_CONTENT_SNAPSHOT } from "../lib/seed-snapshot";

describe("public sitemap", () => {
  it("emits canonical absolute URLs for every indexable localized platform page", () => {
    const entries = sitemapEntries(BUNDLED_PUBLIC_CONTENT_SNAPSHOT, "https://www.tikdd.cc/path-is-ignored");
    expect(entries).toHaveLength(72);
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(entries.length);
    expect(entries.every((entry) => entry.url.startsWith("https://www.tikdd.cc/"))).toBe(true);
    expect(entries.some((entry) => entry.url === "https://www.tikdd.cc/es/instagram-downloader")).toBe(true);
    expect(entries.some((entry) => entry.url === "https://www.tikdd.cc/ja/xhamster-downloader")).toBe(true);
    expect(entries.some((entry) => /\/(faq|help|privacy|terms)$/.test(entry.url))).toBe(false);
    const vimeo = entries.find((entry) => entry.url === "https://www.tikdd.cc/fr/vimeo-downloader");
    expect(vimeo?.alternates?.languages).toMatchObject({
      en: "https://www.tikdd.cc/en/vimeo-downloader",
      fr: "https://www.tikdd.cc/fr/vimeo-downloader",
      ja: "https://www.tikdd.cc/ja/vimeo-downloader",
      "x-default": "https://www.tikdd.cc/en/vimeo-downloader"
    });
    expect(vimeo).not.toHaveProperty("priority");
    expect(vimeo).not.toHaveProperty("changeFrequency");
  });
});
