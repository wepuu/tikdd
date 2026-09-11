# Stage 3 — Content assets and growth measurement

Status: implemented, merged, and deployed from `main@f25c516c8dbdefc90a4f1cc72044e1360ab68003`.

Stage 3 grouped the bilingual X/Instagram Beta content, a read-only Admin growth-readiness view,
and a fixed privacy-safe Google Analytics event catalog into one release. It reused the existing
structured CMS, SEO passports, immutable snapshots, and Stage 1 Google integration boundary.

## Scope delivered

- Bilingual X and Instagram Beta landing-page content, retained as `noindex` and outside the sitemap.
- Read-only Admin growth-readiness view derived from existing content, publication, settings, and
  runtime read models.
- Fixed anonymous events: `resolve_submit`, `resolve_ready`, `resolve_failed`, and
  `download_handoff`. Events carry only a reviewed platform, locale, page type, and bounded failure
  class; they never include URLs, task IDs, tickets, Provider payloads, CDN addresses, cookies, IPs,
  or free-form error text.
- Google Analytics and AdSense remain disabled until the owner enters validated identifiers and
  publishes a complete immutable snapshot.

## Boundaries

No Google reporting API, Search Console API, AdSense reporting, user profile, cookie identifier,
analytics database, Provider, rollout or calibration change was added. SaveFromIns remains the
owner-approved Instagram Beta Provider and Admin remains an on-demand stopped profile.

## Verification and release

Targeted contract, content, SEO, Admin, and Web tests passed with `pnpm check`. The merged release
used GitHub-built immutable images, an encrypted PostgreSQL backup, core health checks, and the
standard short observation loop. No repeated SaveFromIns probing was performed.

## Follow-up

Stage 4 / Work Item 38 adds a first-run Admin bootstrap for the complete bilingual starter set. It
creates only ready drafts before the first snapshot; publication still requires the existing full
maintenance mode and immutable Web acknowledgement.
