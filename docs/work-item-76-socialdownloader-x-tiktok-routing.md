# Work Item 76 — SocialDownloader X/TikTok secondary routing

## Status

Implementation is on `codex/wi76-socialdownloader-x-tiktok-routing`. The branch is stacked on the
CI-verified Work Item 75 commit. Facebook remains the only active SocialDownloader platform until
the release and platform audits complete.

## Scope

This item turns the existing SocialDownloader X and TikTok protocol evidence into independently
controlled secondary routes. It does not add a new Provider adapter or change the public resolve
contract.

- X route: existing approved X Provider → SocialDownloader.
- TikTok route: SnapTik Monster → TikCD → SocialDownloader.
- Instagram and YouTube remain Lab-only.
- Facebook remains `FDown Isuru → SocialDownloader` and keeps its existing rollout.

## Runtime safety

`SOCIALDOWNLOADER_APPROVED_PLATFORMS` and
`SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS` are explicit comma-separated lists. Both default
to `facebook`; the verified list must be a subset of the approved list. Removing one platform from
the lists and its rollout rule is the platform-level rollback and does not disable Facebook.

The Worker retains one shared fail-fast request budget, no queue replay, bounded `Retry-After`
cooldown, and sequential same-platform fallback. Diagnostics use the detected platform and never
include source URLs, provider URLs, response bodies, cookies, or tokens.

## Delivery policies

The following policies are registered independently and retain the exact reviewed host/path:

- `socialdownloader-space-x-media-v1`
- `socialdownloader-space-tiktok-media-v1`

Both use `redirect` and `https://www.socialdownloader.space/api/video`; Delivery still issues a
one-use 302 and never proxies media bytes.

## Validation gate

The existing NL Provider Lab evidence has one additional X and one additional TikTok sample, both
returning one Provider-owned MP4 stream. Before production activation, each platform requires one
browser handoff audit covering the one-use ticket, 302, final MIME/Range response, expiry and
browser behavior. A failed platform is left Lab-only and does not block the other platform.

Raw samples, response bodies, credentials and complete media URLs are not stored in the repository.

## Non-goals

No database migration, public API change, Provider-page handoff, media proxy, Instagram/YouTube
activation, calibration start, or sitemap change is included.
