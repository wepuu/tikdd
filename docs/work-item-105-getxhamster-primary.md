# Work Item 105 — GetXHamster xHamster primary Provider

## Status

Implemented in the development branch. Production gates and rollout remain unchanged until CI,
exact-SHA image verification, backup, and the two-sample browser audit are complete.

## Evidence

An NL VPS protocol probe against one authorized public xHamster sample showed:

- `getxhamster.com` and its `/api/video` endpoint return HTTP 200 JSON without login, Cookie,
  CSRF, browser token, or interactive challenge;
- the response contains four progressive MP4 entries and one adaptive stream entry;
- the first MP4 returned `206 video/mp4` for a 1 KiB Range probe, with CORS `*`;
- the source CDN was a `*.xhcdn.com` host and redirected to a `*.ahcdn.com` host;
- an invalid non-xHamster URL returned HTTP 400 JSON with a deterministic unsupported-link message.

This is a single-sample `resolved` result, not repeatable production qualification. HLS and the
Provider's own `/f` proxy are not accepted as TikDD delivery paths.

## Implementation

- Added the `getxhamster` API adapter with bounded JSON parsing and progressive MP4-only output.
- Added exact reviewed suffix policy `getxhamster-xhamster-media-v1` for `*.xhcdn.com` and
  `*.ahcdn.com`, using browser `cors-download`.
- Added fail-closed activation and platform-scoped configuration with one in-flight request and
  configurable spacing.
- Registered the Provider above 9xBuddy and LocoLoader in the manifest priority order; no database
  migration or public contract change is required.
- Added sanitized success/error fixtures, host-policy tests, route-order tests, activation tests,
  and production release configuration checks.

## Release boundary

Deploy with GetXHamster gates and rollout disabled. After CI and exact-SHA image verification,
backup PostgreSQL/configuration/release manifest, and deploy the GitHub-built images. Then disable
9xBuddy's production rollout, enable only the unique `getxhamster / xhamster / nl` rule, and run two
distinct public browser downloads. Each must produce one GetXHamster attempt, a non-zero MP4, and
browser network traffic to the reviewed CDN hosts. LocoLoader remains the sequential fallback with
its existing shared budget.

Any failure closes the GetXHamster rollout before its gates. xHamster remains Experimental/Beta and
does not enter stable SEO surfaces in this item.
