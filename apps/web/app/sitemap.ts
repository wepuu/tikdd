import type { MetadataRoute } from "next";
import { locales } from "../lib/copy";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  return locales.map((locale) => ({
    url: `${siteUrl}/${locale}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1,
    alternates: {
      languages: {
        en: `${siteUrl}/en`,
        "zh-CN": `${siteUrl}/zh-CN`
      }
    }
  }));
}
