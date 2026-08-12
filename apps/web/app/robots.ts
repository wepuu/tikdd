import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/candidates/",
        "/delivery/",
        "/internal/",
        "/objects/",
        "/results/",
        "/tasks/",
        "/tickets/"
      ]
    },
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
