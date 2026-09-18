# Work Item 77 — SocialDownloader production route closeout

## Status

Implementation starts from `main@200e09bbf5afbe165143b0baa61c5b235ade5924` after Work Item 76.
Facebook remains the active SocialDownloader secondary route. X passed the owner-observed
client-browser handoff audit and is enabled as the sequential secondary route after SSSTwitter.
TikTok was tested once in isolation and remains Lab-only because the secure Delivery handoff was
rejected by the Web client.

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

## TikTok decision and closeout

TikTok received one isolated browser test using the already-reviewed public sample. The test
temporarily disables SnapTik Monster and TikCD so the request can prove the SocialDownloader path,
then restores both primary routes immediately.

- The resolve step returned one SocialDownloader format, but the single Download action produced
  `This format is not available for secure delivery`. This is a failed browser handoff, not a
  reason to broaden Delivery policy or retry the Provider.
- SnapTik Monster and TikCD were restored to 10000 allocation. The unique SocialDownloader TikTok
  rule is CAS-disabled and `tiktok` was removed from both runtime platform lists. TikTok therefore
  remains Lab-only; production order is unchanged.

One request is made for the sample; no repeated synthetic probing is scheduled.

## Operational closeout

- `worker-config-apply` is the only supported operation for applying the platform lists.
- PostgreSQL, environment and rollout snapshots are captured before each production change.
- Admin remains enabled for owner operations; calibration remains disabled.
- A short health check confirms core-container health, no new API/Delivery 5xx, and no
  SocialDownloader provider-wide cooldown.
- Final runtime state is `SOCIALDOWNLOADER_APPROVED_PLATFORMS=facebook,x` and
  `SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS=facebook,x`; Worker revision is
  `wi77-socialdownloader-x-200e09b`.
- Instagram and YouTube remain Lab-only.

If the upstream service shows a provider-wide failure, all SocialDownloader platform rules are
disabled while SSSTwitter, FDown, SnapTik and TikCD remain available. A platform rollback removes
only that platform from both lists and recreates the Worker with `worker-config-apply`.

## Non-goals

No new adapter, database migration, public contract, media proxy, Provider-page handoff, sitemap
change or calibration start is included. Existing immutable GitHub images are reused; a new image
is required only if later code changes are added.
