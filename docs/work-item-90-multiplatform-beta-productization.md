# Work Item 90 — Multi-platform Beta productization and support truth

## Baseline and objective

Work Item 90 starts from merged and deployed `main@f5fc9a20b532487f432047dcc5480508f6e445a1`.
The production system already resolves six owner-approved platform families: TikTok is stable; X,
Instagram, Facebook, Vimeo, and Pinterest operate as bounded Betas. The implementation aligns that
runtime fact with the code-owned catalog, public content, and the single-owner Admin without adding
Provider traffic or a second routing authority.

## Product alignment

- Facebook and Vimeo move from `planned` to `experimental`. Pinterest remains `experimental`,
  TikTok remains `stable`, and X/Instagram remain `experimental`.
- The code-owned bilingual starter set adds noindex Facebook, Vimeo, and Pinterest platform pages.
  Only the existing homepage and stable TikTok page remain indexable and sitemap-eligible.
- Homepage, FAQ, help, social metadata, support chips, and the neutral non-affiliation notice now
  describe X, Instagram, TikTok, Facebook, Vimeo, and Pinterest consistently.
- The new pages use the existing structured platform template, resolver, immutable snapshot,
  Google integration, and fixed metadata boundaries. They add no raw scripts, remote citations,
  arbitrary JSON-LD, or Provider-specific fields.

## Admin support-truth ledger

The Providers workspace gains one compact read-only ledger. Each platform row aligns:

- catalog lifecycle and public-availability state;
- active primary/fallback route names and circuit state;
- natural task, Provider-attempt, browser-handoff, fallback, and latest-event aggregates;
- code-owned page definition, published locale coverage, index eligibility, and sitemap presence.

The ledger derives from the existing sanitized platform, route, Beta health, content, and SEO read
models. It never probes a Provider and does not infer a saved file from a browser handoff. It flags
only cross-authority drift: an active route under a planned/paused catalog entry, a missing public
page, an experimental page in the sitemap, route/public-listing disagreement, or an active platform
missing from release-owned public support copy. Missing natural traffic remains explicitly unknown.

## Boundaries

- No public API, OpenAPI, database, rollout, gate, circuit, retry, Delivery, or media-host change.
- No new Provider and no live Provider request during implementation or release verification.
- Existing X, Instagram, TikTok, Facebook, Vimeo, and Pinterest route order remains authoritative.
- Admin remains available for the owner workflow; calibration remains stopped.
- Publishing the new production content remains an explicit owner operation using the existing
  `full` write mode and immutable snapshot acknowledgement.

## Verification and release

Tests cover the six-platform catalog/copy surface, bilingual Beta pages, noindex/sitemap boundaries,
legacy GEO references, starter bootstrap, and Admin drift derivation. Handoff requires targeted
tests, `pnpm check`, `git diff --check`, and production Compose validation.

The release is one PR and one deployment. Deploy exact-SHA GitHub images after PostgreSQL/config
backup with every existing Provider gate and rollout unchanged. Publish one reviewed content
snapshot for the three new bilingual pages, verify localized HTTP/metadata/Google tag output, and
observe service health without synthetic Provider traffic.
