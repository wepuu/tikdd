# Multilingual SEO baseline

## Indexable surfaces

- Locale home pages and future human-reviewed platform/help/legal pages.
- A stable URL per language, with a self canonical and reciprocal hreflang.
- Sitemap entries only for pages that return useful content without running a resolve task.

## Non-indexable surfaces

- Resolve tasks, user results, delivery endpoints, temporary objects, and API documentation in
  production.
- Responses use `X-Robots-Tag: noindex, nofollow, noarchive` in addition to not being linked from
  sitemaps.
- Expired resources return 404/410; submitted URLs never appear in a public path.

## Content rules

- Do not launch a platform page until the catalog entry is `stable` and at least one monitored
  production provider works in the target region.
- Each locale is written or reviewed by a fluent editor; do not bulk-publish thin translated pages.
- Explain platform limitations, authorization requirements, format behavior, and actionable failure
  cases rather than repeating download keywords.
- Do not publish scraped video metadata as programmatic SEO pages.
- Do not generate pages from the raw yt-dlp extractor list. Consolidate extractors into useful
  platform families and require human-reviewed, locale-specific content.

## Technical checklist

- Server-rendered visible content and metadata.
- Correct document `lang`, title, description, canonical, hreflang, Open Graph, and sitemap URLs.
- No locale selection based only on IP; language links remain crawlable.
- Accessible form labels, keyboard focus, status announcements, and reduced-motion support.
- Core Web Vitals budgets added before third-party analytics or advertising scripts.
