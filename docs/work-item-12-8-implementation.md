# Work item 12.8 — SEO configuration and publication rules

Status: complete on 2026-08-12.

## Delivered

- Added localized path, search title/description, social title/description, approved asset reference,
  index intent, sitemap intent, and safe local redirect editing through the existing page revision.
- Added a runtime-validated SEO technical view that derives canonical paths, hreflang groups,
  sitemap entries, redirects, eligibility, and code-owned structured-data template names.
- Added hard blockers for private route prefixes, localized path/redirect collisions, redirect
  chains and loops, published slug changes without the previous path redirect, sitemap conflicts,
  and platform pages without stable catalog plus monitored eligible regional routing.
- Added a private Admin API read at `/admin/v1/content/seo`; no public API or resolve contract changed.
- Added the Search index passport UI with live Search and Social previews and exact page/locale scope.
- Kept Admin/API/task/result/delivery/internal route indexability immutable and outside editorial
  input. Arbitrary canonical URLs, robots XML, JSON-LD, remote images, and absolute redirects remain
  rejected.

## Verification

- `pnpm test:work-item-12-8`: 9 files and 40 tests passed.
- Type checks passed for Admin contracts, Admin API, and Admin.
- Desktop and 390 × 844 browser QA passed with no document or SEO-workbench horizontal overflow.
- Full repository lint, type checks, tests, and production builds passed after implementation.

Work item 12.9 will consume these derived rules from the immutable active snapshot. Until then the
existing public Web metadata, robots, and sitemap remain code-owned and unchanged.
