# Work Item 23 — Instagram Beta landing page

## Scope

Work Item 23 adds a reviewed English and Simplified Chinese Instagram landing page at the
structured route `/[locale]/instagram-downloader`. It reuses the published platform-page schema,
the existing resolver form, immutable content snapshots, and the derived SEO passport. No provider,
rollout, Admin, calibration, or API boundary changes are included.

## Content and rendering

- The bundled known-good snapshot contains one `page_instagram` cell for `en` and `zh-CN`.
- Each cell uses the `platform` template with a short introduction, three resolver steps,
  limitations, and FAQ answers about public Instagram links.
- The route renders the shared URL resolver so a visitor can submit an Instagram Reel or post
  without a separate product flow.
- The page keeps the existing neutral non-affiliation notice and public-content boundary.

## SEO safety

The page is intentionally `indexable=false` and `includeInSitemap=false`. The SEO passport derives
no `hreflang` entries for noindex pages. An experimental platform page with those flags is allowed
for human editorial review; if an editor requests indexability or sitemap membership before the
platform is eligible, the passport returns `platform_not_eligible` and publication remains blocked.

Production content publication is a separate owner action through the existing Admin structured
editor and immutable snapshot acknowledgement. This implementation does not start Admin or make
the page indexable.

## Verification

- Admin contract tests cover noindex experimental review and stable-only indexability.
- Web tests cover bilingual seed content, metadata, and hreflang exclusion.
- `pnpm lint`, targeted Vitest suites, and workspace type checks pass before PR CI.
