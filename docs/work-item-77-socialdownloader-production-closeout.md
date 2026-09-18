# Work Item 77 — SocialDownloader production route closeout

## Status

Implementation starts from `main@200e09bbf5afbe165143b0baa61c5b235ade5924` after Work Item 76.
Facebook remains the active SocialDownloader secondary route. X has passed an owner-observed
client-browser handoff audit and is ready to become the secondary route after the production
configuration change. TikTok remains pending one isolated client-browser handoff audit.

## Evidence boundary

The X audit used the owner's local browser network and completed a non-zero video download while
the SocialDownloader X route was isolated. The NL VPS can receive the Provider stream metadata and
issue the reviewed one-use Delivery redirect, but a direct server-side media request may return
HTTP 403. That result is not treated as a client delivery failure: the production topology is
intentionally `NL Delivery → 302 → Provider stream → user's browser`.

The audit records only the platform, route, handoff result and sanitized health outcome. It does
not persist source URLs, full Provider URLs, signed query parameters, response bodies, cookies,
tokens or user data. No NL-side media download probe is added.

## X activation

After the release backup and Worker configuration check:

```dotenv
SOCIALDOWNLOADER_APPROVED_PLATFORMS=facebook,x
SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS=facebook,x
```

The existing `socialdownloader-space / x / nl` rule is enabled with CAS. SSSTwitter remains the
X primary route; SocialDownloader is sequential fallback only. No duplicate rule is created and
the Facebook route is unchanged.

## TikTok decision

TikTok receives one isolated browser test using the already-reviewed public sample. The test
temporarily disables SnapTik Monster and TikCD so the request can prove the SocialDownloader path,
then restores both primary routes immediately.

- Success: retain the unique SocialDownloader TikTok rule and add `tiktok` to both platform lists,
  producing `SnapTik Monster → TikCD → SocialDownloader`.
- Failure, rate limit, challenge or unusable browser handoff: remove `tiktok` from both lists and
  CAS-disable only the SocialDownloader TikTok rule. No retry or Host policy expansion is allowed.

One request is made for the sample; no repeated synthetic probing is scheduled.

## Operational closeout

- `worker-config-apply` is the only supported operation for applying the platform lists.
- PostgreSQL, environment and rollout snapshots are captured before each production change.
- Admin remains enabled for owner operations; calibration remains disabled.
- A short health check confirms core-container health, no new API/Delivery 5xx, and no
  SocialDownloader provider-wide cooldown.
- Instagram and YouTube remain Lab-only.

If the upstream service shows a provider-wide failure, all SocialDownloader platform rules are
disabled while SSSTwitter, FDown, SnapTik and TikCD remain available. A platform rollback removes
only that platform from both lists and recreates the Worker with `worker-config-apply`.

## Non-goals

No new adapter, database migration, public contract, media proxy, Provider-page handoff, sitemap
change or calibration start is included. Existing immutable GitHub images are reused; a new image
is required only if later code changes are added.
