import type { MetadataRoute } from "next";
import { alternatesForPage } from "../lib/content-presentation";
import { getPublishedSnapshot, localizedPath } from "../lib/published-content";

export function sitemapEntries(snapshot: Awaited<ReturnType<typeof getPublishedSnapshot>>, siteUrl: string): MetadataRoute.Sitemap {
  const origin = new URL(siteUrl).origin;
  return snapshot.pages
    .filter((page) => page.seo.indexable && page.seo.includeInSitemap)
    .sort((left, right) => localizedPath(left.locale, left.seo.localPath).localeCompare(localizedPath(right.locale, right.seo.localPath)))
    .map((page) => ({
    url: new URL(localizedPath(page.locale, page.seo.localPath), origin).toString(),
    lastModified: new Date(snapshot.generatedAt),
    alternates: { languages: Object.fromEntries(Object.entries(alternatesForPage(snapshot, page)).map(([locale, path]) => [locale, new URL(path, origin).toString()])) }
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const snapshot = await getPublishedSnapshot();
  return sitemapEntries(snapshot, siteUrl);
}
