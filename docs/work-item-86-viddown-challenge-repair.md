# Work Item 86 — VidDown dynamic token and challenge-chain repair

## Baseline and production evidence

This item starts from merged `main@481264b`. VidDown was enabled once for the
authorized browser validation and the first public Vimeo sample failed with
`provider_challenge`. The production attempt ledger contains one
`viddown-net / vimeo` attempt and no replay; the rollout was then CAS-disabled
and all three VidDown gates were turned off. The second sample was intentionally
not submitted.

The existing failure code does not identify whether the challenge came from the
landing page, the legacy token endpoint, or `getLoaderList`. Worker logs from
the short validation window are not retained after the worker recreation, so
this item adds bounded internal phase diagnostics before another production
activation.

## Implementation

- Add a typed, internal-only `viddown_resolution_diagnostic` event with phase,
  status/content-type category, bounded response size, challenge marker,
  token source/validity, session-cookie presence, valid media count, failure
  code and duration.
- Never emit source URLs, Token values or hashes, Cookie values, response
  bodies, request headers, or CDN URLs.
- Accept the observed inline page-token assignment up to a bounded 4096
  characters, including safely decoded quoted values. Distinguish an absent
  token from a present-but-invalid token; only an absent token may use the
  legacy endpoint.
- Merge short-lived response cookies by name within the current request chain,
  avoiding duplicate stale values. No cookie or token is persisted.
- Keep the exact page/API/media host allowlists, one loader request, existing
  timeout and no automatic VidDown replay policy.
- Use the same explicit request identity on page and loader calls while adding
  no browser fingerprint, CAPTCHA token, user Cookie, login state or challenge
  bypass.

## Tests and acceptance

- Inline tokens over the former 512-character bound are accepted only when they
  pass the bounded character and length checks.
- A malformed inline-token marker returns `provider_schema_changed` and does
  not call the legacy endpoint.
- Cookie values are merged with last-value-wins semantics within one request
  chain.
- Landing and loader challenges produce the correct phase diagnostics, while
  serialized diagnostics contain none of the token, URL, cookie, body or CDN
  data.
- Existing MP4 parsing, exact Vimeo Host policy, Delivery redirect behavior,
  retry policy and public result opacity remain unchanged.
- Run targeted VidDown/provider/router tests, `pnpm check`, `git diff --check`
  and production Compose validation.

## Revalidation boundary

Production remains disabled during implementation. After CI and image
verification, run one bounded NL protocol canary from the exact Worker image.
Only if it succeeds may the VidDown gates be enabled and the existing
`viddown-net / vimeo / nl` rule be CAS-updated for the two browser samples.
The first sample must succeed before submitting the second. Any challenge or
download failure immediately disables the rollout and then the three gates.

If the provider requires browser-only security state or interactive challenge
completion, classify it as blocked and leave VidDown disabled. Do not add a
proxy, broaden Host policy, use user credentials, or add Vimeo to the sitemap.
