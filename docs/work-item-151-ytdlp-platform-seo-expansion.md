# Work Item 151: yt-dlp platform expansion, SEO publication, and provider precedence

## Status

Implementation branch: `codex/wi151-seo-ytdlp-platform-expansion`
Baseline: `main@a82281f` (Work Item 150)

This item separates yt-dlp's extractor inventory from TikDD product availability. The official
supported-sites list is an extractor reference, not a compatibility guarantee; each platform must
already exist in TikDD's curated catalog and have a reviewed, active route before it receives a
public page. New yt-dlp candidates remain qualification work until a provider and Delivery path
have been verified.

## Product and SEO changes

- Dailymotion keeps its existing experimental runtime route and receives the same nine-locale
  `/dailymotion-downloader` publication treatment as the other reviewed Beta pages.
- A localized `/platforms` directory is seeded for every enabled locale. It links to the current
  catalog-backed platform pages and does not claim support for planned yt-dlp extractors.
- The generated sitemap, canonical metadata, reciprocal hreflang, and structured data include the
  Dailymotion pages and the directory after the existing Admin publication snapshot is promoted.
- Task/result/private operational routes remain noindex. Provider IDs, upstream URLs, cookies,
  headers, and Delivery credentials never enter public content.

## Legacy URL policy

The Nginx origin template now has a bounded target map for retired root downloader slugs. Known
aliases issue one clean `301` to the English localized canonical page, without carrying tracking
queries. The existing catch-all legacy map remains a homepage-only redirect for retired content;
arbitrary paths and localized future paths are not redirected.

## Routing policy

Provider selection remains manifest-owned and sequential. A stable or reviewed third-party
Provider stays ahead of the isolated yt-dlp fallback for its platform; yt-dlp is not promoted just
because its extractor list contains a site. Planned catalog entries do not receive pages, host
allowlists, rollout rules, or SEO claims in this item.

## Verification and release boundary

- Starter contracts cover 135 localized records, 99 indexable/sitemap entries, the Dailymotion
  pages, and the platform directory.
- Web tests cover Dailymotion sitemap/hreflang output and directory publication.
- Nginx tests cover the target map, one-hop 301 status, query removal, and the existing bounded
  legacy-home behavior.
- Run the targeted Vitest suites, `pnpm check`, `git diff --check`, and production Compose
  validation. Publishing the Admin snapshot and deploying the exact image remain separate approved
  release actions.

## Explicit non-goals

- No new yt-dlp adapter, platform catalog entry, Provider gate, rollout rule, database migration,
  or media Delivery mode.
- No automatic SEO pages for every site in yt-dlp's upstream extractor inventory.
- No change to existing Provider traffic, Admin lifecycle, calibration, or production routes.
