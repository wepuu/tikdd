# Work Item 66 — FDown Isuru Facebook Beta adapter

Status: implemented, disabled; no production deployment

Baseline: `main@13296b4`

## Delivered

- Added `FDownIsuruProvider` with the observed anonymous JSON `POST /download` protocol.
- Added tolerant response normalization for `video_info`, `download_url` and
  `available_formats`; optional metadata does not invalidate a usable MP4.
- Added typed handling for private/unavailable posts, rate limits, challenges, authentication,
  unsupported URLs, schema changes and no-media responses.
- Added `fdown-isuru-facebook-media-v1` Delivery policy for the reviewed `fna.fbcdn.net` suffix.
- Registered the disabled Provider in Worker, API health diagnostics and Admin route previews.
- Added three fail-closed activation gates and production template defaults.
- Added sanitized fixtures and tests for success, optional fields, private/not-found, rate-limit,
  challenge, malformed/no-media responses, request shape, public result redaction and Delivery
  host boundaries.

## Safety and release state

The adapter makes at most one upstream request per task, uses a ten-second timeout, caps responses
at 512 KiB and rejects upstream redirects. It sends no user Cookie, login state or unrelated
headers. Delivery continues to issue a one-use short-lived `302`; it never reads or streams media
bytes. No database migration, rollout rule, production environment change or deployment was made.

The next release step is a separately approved disabled-image deployment, followed by terms and
Delivery audit approval, creation of the unique Facebook NL rollout rule, and two real browser
downloads. If either browser handoff or Host validation fails, keep the rule and all three gates
off. Facebook remains experimental and is not added to sitemap or stable SEO pages in this item.
