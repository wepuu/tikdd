# Work Item 108 — Multilingual SEO/GEO publication

## Outcome

TikDD now carries a reviewed nine-locale content pack: English, Simplified Chinese, Spanish,
French, German, Italian, Turkish, Polish, and Japanese. The public CTA follows download intent in
each language while the underlying asynchronous resolve API remains unchanged.

Every currently integrated product platform has a localized downloader page in the content pack:
X, Instagram, TikTok, Facebook, Vimeo, Pinterest, and xHamster. Beta maturity labels remain
visible. xHamster is not promoted on the homepage, but its dedicated page can participate in search
after the normal production-route and publication checks pass.

## Search and publication boundary

- Platform search eligibility now accepts both `stable` and `experimental` catalog entries when a
  manifest-enabled, delivery-verified production route has non-zero allocation and an acceptable
  runtime state.
- Every index request still requires complete localized content and reviewed GEO fields.
- Canonical and reciprocal `hreflang` metadata include all published locale variants and
  `x-default` points to English.
- The XML sitemap contains only indexable home and platform pages, uses absolute URLs derived from
  the configured origin, uses the content snapshot timestamp, and omits `priority` and
  `changefreq` hints.
- FAQ, help, privacy, terms, task, result, delivery, API, and Admin URLs remain outside the sitemap.

## Content-pack operation

The Admin content-pack preview/apply action is no longer limited to the first snapshot. An explicit
apply creates missing locale drafts and updates the reviewed pages and shared copy as `ready`.
Google Analytics and AdSense identifiers are preserved. The owner must inspect the SEO technical
view and publish the resulting immutable snapshot separately; deploy alone does not mutate public
content.

## Verification

- Contracts validate 108 localized page records and nine shared-content records.
- Web tests cover localized Download labels, metadata, reciprocal language alternates, a 72-entry
  sitemap, and the xHamster homepage-exclusion boundary.
- Admin tests cover idempotent application of the multilingual content pack and experimental
  platform readiness without weakening Provider or runtime gates.

