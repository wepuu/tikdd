# Work Item 45 — TikTok free Provider batch

## Scope

Evaluate the four owner-supplied free TikTok candidates as one stage-level batch and implement only
the candidate that fits TikDD's existing bounded resolver and redirect Delivery model. Keep all new
traffic disabled until a separate approval/deploy loop.

## Delivered

- Added the disabled `SnapTikMonsterProvider` adapter for public TikTok video URLs.
- Added a runtime-validated manifest, explicit page/media host policies, CSRF form handling, bounded
  HTML parsing, normalized redirect candidates, and typed terminal/retryable errors.
- Added sanitized fixtures and tests for success, private/not-found/empty results, schema changes,
  challenges, rate limits, and host spoofing. The public normalized result never contains a
  downloadable CDN URL.
- Added independent `SNAPTIK_MONSTER_TERMS_APPROVED` and
  `SNAPTIK_MONSTER_DELIVERY_AUDIT_APPROVED` gates. The Worker, API, Admin projection, and preflight
  manifest lists recognize the provider, but the default remains false.
- Recorded candidate decisions: SnapTik Monster accepted for disabled implementation; SSSTik
  deferred after an empty parse response; TTSave deferred for server-side job delivery; Collabstr
  rejected as a non-resolution marketplace.

## Explicitly not included

- no rollout rule, live production allocation, database migration, or deployment;
- no change to X/Instagram gates or routing;
- no headless-browser challenge bypass, user cookies, generic extractor, media proxy, or public
  upstream URL;
- no frequent live probing in CI or local tests.

## Handoff

Run targeted adapter and Delivery tests, then `pnpm check`. A later release may request one bounded
authorized canary and redirect verification. Until that authorization, keep the adapter and both
gates disabled and do not advertise TikTok as a newly supported production platform.
