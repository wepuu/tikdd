import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const origin = new URL(siteUrl).origin;
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
    sitemap: new URL("/sitemap.xml", origin).toString(),
    host: origin
  };
}
