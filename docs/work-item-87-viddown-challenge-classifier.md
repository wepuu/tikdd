# Work Item 87 — VidDown landing challenge false-positive repair

## Production evidence and safe state

Work Item 86 was deployed at `main@4cd35b2` with VidDown disabled. During the authorized manual
validation window the existing `viddown-net / vimeo / nl` rule was enabled once. Three distinct
tasks each produced exactly one VidDown attempt and failed at the landing phase with
`provider_challenge`. Every response was HTTP 200 HTML with the same bounded response size; no
attempt reached inline-token selection, the legacy token endpoint, the loader API or Delivery.

This matched the size of the previously successful protocol page and isolated the failure to the
generic body-marker check running before the VidDown token parser. A normal provider page can load
Cloudflare or Turnstile libraries without being an active interstitial. Treating a bare
`cf-turnstile` or `challenge-platform` string as sufficient therefore produced a false positive.

The rollout was CAS-disabled at revision 4 with zero allocation, then all three VidDown gates were
closed through `worker-config-apply`. The production configuration revision is
`wi86-viddown-rollback-4cd35b2`; Worker and the other core services remained healthy. No additional
Provider request is part of this implementation.

## Implementation

- `requestText` now accepts an optional Provider-owned challenge classifier. Its existing default
  body-marker behavior remains unchanged for every adapter that does not opt in.
- VidDown classifies HTTP 403 as a challenge and recognizes HTTP 200 HTML only when it has
  document-level evidence: an access-denied title/heading, or a Cloudflare title/Turnstile widget
  combined with a challenge form/container.
- Full document-level challenge evidence remains authoritative. Otherwise, a valid inline page
  token is accepted even when the normal page contains static library references. A present but
  invalid token still returns `provider_schema_changed`; an absent token may use the existing
  bounded legacy fallback.
- Loader and legacy JSON responses use the same VidDown classifier. Plain JSON text containing a
  challenge-related word is not an interstitial; HTML with structural challenge evidence remains
  blocked.
- The sanitized diagnostic event adds `challengeReason` (`http_403`,
  `access_denied_document`, `cloudflare_interstitial`, or `none`) and records only whether a
  response exposed a session cookie. It never records token, cookie, response body, source URL,
  request headers or CDN URL.

No public contract, database schema, Delivery policy, Host allowlist, queue retry policy, media
transport or provider priority changes in this item.

## Verification

Synthetic fixtures cover a valid inline token on a normal page that also references
`cf-turnstile` and `challenge-platform`, an HTTP 200 Cloudflare interstitial, an HTTP 200 access
denial, an HTTP 403 loader challenge, invalid tokens and the legacy compatibility path. The
fixtures contain no production token, cookie, source URL, response body or signed media address.

Required checks are the focused VidDown suite, the complete Provider suite, package type checking,
`pnpm check`, `git diff --check` and production Compose validation.

## Revalidation boundary

The merged release must be deployed with VidDown gates false and rollout revision 4 unchanged.
After backup and exact-image verification, one bounded NL protocol canary may perform one landing
request, at most one loader request and a 1 KiB media Range check, with no retry or retained raw
payload. Only a successful canary may precede gate activation and a CAS rollout enable.

Manual browser validation is sequential: the first owner sample must produce one successful
attempt and a working download before the second sample is submitted. Any challenge, parse error or
download failure first disables the rollout and then closes the three gates. VidDown remains Vimeo
Experimental/Beta and outside the sitemap.
