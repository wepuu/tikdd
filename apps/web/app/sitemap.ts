import type { MetadataRoute } from "next";
import { alternatesForPage } from "../lib/content-presentation";
import { getPublishedSnapshot, localizedPath } from "../lib/published-content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const snapshot = await getPublishedSnapshot();
  return snapshot.pages.filter((page) => page.seo.indexable && page.seo.includeInSitemap).map((page) => ({
    url: `${siteUrl}${localizedPath(page.locale, page.seo.localPath)}`,
    lastModified: new Date(snapshot.generatedAt),
    changeFrequency: "weekly",
    priority: page.pageType === "homepage" ? 1 : 0.7,
    alternates: { languages: Object.fromEntries(Object.entries(alternatesForPage(snapshot, page)).map(([locale, path]) => [locale, `${siteUrl}${path}`])) }
  }));
}
