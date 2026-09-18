# ADR-0037: SocialDownloader platform-level activation

## Status

Accepted for Work Item 76 and operationally extended by Work Item 77. Facebook remains active;
X is client-browser-audited and enabled as a secondary route. TikTok's single isolated browser
handoff audit failed at secure Delivery, so TikTok remains Lab-only.

## Decision

SocialDownloader is one upstream service but each platform is a separate operational capability.
Delivery policies, rollout rules, circuits, attempt records, and rollback decisions remain keyed by
`socialdownloader-space / platform / nl`.

The Worker uses two explicit platform lists:

- `SOCIALDOWNLOADER_APPROVED_PLATFORMS` controls which platform requests the adapter may submit.
- `SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS` controls which capabilities expose a production
  `redirect` mode in the Provider manifest.

The delivery-verified list must be a subset of the approved list. Both default to `facebook`, so a
new image cannot silently create X or TikTok traffic. A platform rollback removes only that
platform from the lists and disables its rollout rule; it does not take the Facebook secondary
route offline.

## Route order

- X: existing approved X Provider first, then SocialDownloader.
- TikTok: SnapTik Monster, then TikCD. SocialDownloader remains a Lab-only candidate because its
  isolated browser handoff was rejected by the secure Delivery check.

Fallback remains sequential and bounded. Terminal URL/private/content errors do not advance to the
next Provider. SocialDownloader keeps one request per task and a shared fail-fast budget across all
platforms, including bounded `Retry-After` cooldowns.

## Delivery boundary

X and TikTok use separate versioned policies even though both currently target the reviewed
`https://www.socialdownloader.space/api/video` path. Delivery continues to issue a one-use 302 and
does not read or proxy media bytes. Provider pages, user cookies, challenge bypass, and arbitrary
upstream URLs remain forbidden.

## Rollback

If one platform fails, CAS-disable only its rollout rule, remove it from both runtime lists, and
recreate the Worker with the release-env-bound operation. Work Item 77 applied this rollback to
TikTok after the secure handoff rejection; X and Facebook remain unchanged. If the upstream service
has a provider-wide outage or rate-limit event, disable all SocialDownloader platform rules while
keeping the existing primary Providers available. No host policy is broadened during rollback.
