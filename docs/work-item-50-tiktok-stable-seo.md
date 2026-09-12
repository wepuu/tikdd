# Work Item 50 — TikTok stable promotion and sitemap publication

Status: implementation complete locally on `codex/wi50-tiktok-stable-seo`; production rollout and
content snapshot publication remain pending the normal PR and deployment approvals.

## Decision

Owner-provided natural traffic testing passed for the active SnapTik Monster route. The sanitized
production aggregate recorded eight successful public TikTok tasks (seven after the one-time
acceptance), eight successful provider attempts, and matching successful Delivery ticket, redirect,
and redemption outcomes. TikTok can therefore move from `experimental` to `stable` in the curated
platform catalog. X and Instagram remain experimental Betas.

This is a platform/content promotion only. It does not start Admin permanently, calibration, a new
Provider, or any additional traffic. The existing `snaptik-monster / tiktok / nl` route and its
gates remain unchanged.

## Implementation

- Mark the TikTok catalog entry `stable`; keep explicit TikTok host rules and the SnapTik manifest
  boundary unchanged.
- Update the bilingual starter and release-owned homepage copy so TikTok is described as supported
  while X and Instagram remain public Betas.
- Mark the bilingual TikTok landing pages as `indexable` and `includeInSitemap`, with reviewed GEO
  content and stable titles. X and Instagram pages remain noindex and outside the sitemap.
- Extend platform, content, metadata, structured-data, and GEO tests to cover the stable TikTok
  state, reciprocal hreflang, and sitemap eligibility.
- Publish the corresponding English and Simplified Chinese page/SEO drafts in one owner-only Admin
  maintenance session after the code release. The public sitemap is still derived from the active
  immutable snapshot; changing code alone does not alter the production snapshot.

## Release and verification

1. Run targeted tests and `pnpm check`; push the branch and merge only after PR CI is green.
2. Verify Web, Service, and Admin GitHub-built image digests for the merge SHA. Admin remains stopped
   outside the short publication session.
3. Back up PostgreSQL and production configuration, deploy the exact GitHub images, and run core
   health checks without changing Provider gates or rollout allocation.
4. In an on-demand `full` Admin session, set both TikTok pages to `indexable=true` and
   `includeInSitemap=true`, confirm the TikTok presentation is listed, publish one immutable
   snapshot, verify Web acknowledgement, then restore `ADMIN_WRITE_MODE=readonly` and stop Admin.
5. Verify both localized TikTok pages return 200 with indexable metadata, reciprocal hreflang,
   structured data, and entries in `sitemap.xml`; verify X and Instagram remain noindex/outside the
   sitemap and no private/task/delivery path is indexed.

## Rollback

If publication validation fails, roll back the content snapshot to the previous propagated revision.
If the code deployment itself is faulty, restore the previous GitHub-built release. Do not disable
the healthy TikTok route solely because a search-engine cache has not refreshed yet; investigate the
snapshot/SEO passport first.
