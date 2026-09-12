# Work Item 49 — TikTok Beta closure and free-Provider expansion gate

Status: plan prepared after Work Item 48 production deployment; awaiting separate Admin publication
and TikTok activation approvals.

## Current production facts

- Release: `main@5008685f2f50528ac1861e5b95c14d549013d1c1`.
- Work Item 48's one-click Delivery handoff is deployed from GitHub-built immutable images.
- The unique `snaptik-monster / tiktok / nl` rollout rule is revision 3, disabled, and allocated 0%.
- `ENABLE_SNAPTIK_MONSTER_PROVIDER`, `SNAPTIK_MONSTER_TERMS_APPROVED`, and
  `SNAPTIK_MONSTER_DELIVERY_AUDIT_APPROVED` are all `false`.
- `/en/tiktok-downloader` and `/zh-CN/tiktok-downloader` currently return 404 because a TikTok
  content snapshot has not been published.
- X and Instagram rollout and gates are unchanged. Admin, calibration, and other Providers are off.

## Stage A — publish the TikTok content snapshot

Run one approved on-demand Admin maintenance session:

1. Back up PostgreSQL and production configuration.
2. Start Admin in `full` mode for the owner only.
3. Review or create the bilingual TikTok starter pages and publish one immutable snapshot.
4. Verify `/en/tiktok-downloader` and `/zh-CN/tiktok-downloader` return 200 with `noindex`, remain
   outside sitemap/hreflang output, and identify TikTok as experimental.
5. Return Admin to `readonly` and stop the Admin profile.

This stage does not enable SnapTik or send a Provider request.

## Stage B — one-time SnapTik acceptance

After a separate production approval:

1. Enable the three SnapTik gates and restart only API/Worker.
2. CAS-update the existing revision-3 rule to `enabled=true`, `allocationBps=10000`, with no expiry.
3. Use one currently public TikTok URL and capture only sanitized outcomes for task creation, ticket
   redemption, redirect validation, browser handoff, and non-zero media delivery.
4. Perform a short core-health check without repeating the Provider request.

If any layer fails, CAS-disable the rule first and then close the three gates. Do not widen Host
allowlists, add a proxy, bypass challenges, or repeatedly probe the Provider.

## Stage C — natural-traffic decision and free-provider batch

On success, keep TikTok as experimental and judge the first ten natural tasks. A success rate of at
least 70% keeps SnapTik as the Beta route. Lower success, recurring 403/429/challenge responses, or
an opened circuit starts the next free-Provider feasibility batch and keeps SnapTik disabled or as a
standby candidate. Do not claim a fallback relationship until another Provider passes the same review.

The next free-provider batch accepts 3–5 owner-supplied candidates, performs one bounded public
feasibility request per candidate, and implements all accepted adapters together behind disabled
manifests. Each adapter requires sanitized fixtures, explicit page/media Host policy, sequential
fallback tests, Delivery redirect verification, `pnpm check`, one PR, one GitHub-image deployment,
and one real acceptance request.

## Non-goals

- No paid Provider, calibration, permanent Admin process, repeated synthetic testing, media proxy,
  public upstream URL, cookie or challenge bypass.
- No stable promotion or TikTok indexing until a later evidence and content decision.
