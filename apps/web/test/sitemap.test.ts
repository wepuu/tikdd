import { describe, expect, it } from "vitest";
import { sitemapEntries } from "../app/sitemap";
import { BUNDLED_PUBLIC_CONTENT_SNAPSHOT } from "../lib/seed-snapshot";

describe("public sitemap", () => {
  it("emits canonical absolute URLs for every indexable localized platform page", () => {
    const entries = sitemapEntries(BUNDLED_PUBLIC_CONTENT_SNAPSHOT, "https://www.tikdd.cc/path-is-ignored");
    expect(entries).toHaveLength(27);
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(entries.length);
    expect(entries.every((entry) => entry.url.startsWith("https://www.tikdd.cc/"))).toBe(true);
    expect(entries.some((entry) => entry.url === "https://www.tikdd.cc/es/instagram-downloader")).toBe(false);
    expect(entries.some((entry) => entry.url === "https://www.tikdd.cc/en/youtube-downloader")).toBe(false);
    expect(entries.some((entry) => entry.url === "https://www.tikdd.cc/ja/xhamster-downloader")).toBe(false);
    expect(entries.some((entry) => entry.url === "https://www.tikdd.cc/en/dailymotion-downloader")).toBe(false);
    expect(entries.some((entry) => entry.url === "https://www.tikdd.cc/en/tiktok-downloader")).toBe(true);
    expect(entries.some((entry) => entry.url === "https://www.tikdd.cc/ja/platforms")).toBe(true);
    expect(entries.some((entry) => /\/(faq|help|privacy|terms)$/.test(entry.url))).toBe(false);
    expect(entries.some((entry) => entry.url === "https://www.tikdd.cc/fr/vimeo-downloader")).toBe(false);
    const tiktok = entries.find((entry) => entry.url === "https://www.tikdd.cc/fr/tiktok-downloader");
    expect(tiktok?.alternates?.languages).toMatchObject({
      en: "https://www.tikdd.cc/en/tiktok-downloader",
      fr: "https://www.tikdd.cc/fr/tiktok-downloader",
      ja: "https://www.tikdd.cc/ja/tiktok-downloader",
      "x-default": "https://www.tikdd.cc/en/tiktok-downloader"
    });
    expect(tiktok).not.toHaveProperty("priority");
    expect(tiktok).not.toHaveProperty("changeFrequency");
  });
});
