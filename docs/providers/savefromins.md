# SaveFromIns provider feasibility record

- Provider ID: `savefromins`
- Site: <https://savefromins.com/>
- Evaluated platform: Instagram
- Evaluated region: `nl`
- Review date: 2026-09-06
- Production approval: automated-use decision recorded; route qualification failed and traffic is disabled
- Manifest capability: Instagram in `nl`, disabled by default
- Delivery policy: new candidates use `savefromins-instagram-media-v2`; version 1 remains registered for compatibility
- Runtime state: deployed from `main@7ddafbd`; rule revision 6 has zero allocation and all activation gates are false

## Work Item 21 implementation

The production-disabled adapter was merged and deployed from `main@00bc4b9` with
strict JSON validation, bounded requests, normalized errors, deterministic fixtures, NL-only
Manifest scope, rollout gating, and no live CI dependency. A second owner-supplied public sample
resolved successfully and returned a different `cdninstagram.com` edge host, confirming that a
single exact edge hostname is not a viable Delivery policy.

ADR-0021 therefore permits only real subdomains of the code-reviewed `cdninstagram.com` suffix and
retains HTTPS, label-boundary spoof rejection, and redemption-time public DNS validation. The
adapter remains off unless terms approval, Delivery audit approval, and the Provider request marker
are all explicitly configured. This implementation does not grant production traffic.

## Public workflow observed

The public page completed with HTTP 200 and exposed a browser-side form submission to an HTTPS API
on `api.savefromins.com`. The request accepted a canonical public Instagram link without an account
Cookie, Instagram `sessionid`, CAPTCHA, or interactive challenge. Its front-end request marker is
treated as Provider protocol detail and is not recorded as a TikDD credential or public contract.

The project owner supplied two public Reel samples. TikDD removed the `utm_source` and `stkn` query
parameters and submitted both canonical URLs during bounded reviews from the NL environment. The
first API response returned
HTTP 200 with a success state, one normalized-looking `720P` MP4 resource, and a direct candidate on
`scontent-bos5-1.cdninstagram.com`. The second resolved successfully and returned a different
`cdninstagram.com` edge hostname, which is why the policy is suffix-scoped with label-boundary
validation instead of pinned to one edge.

A bounded 1 KiB Range request resolved the observed candidate host only to public addresses, used
HTTPS without a redirect, returned HTTP 206 and `video/mp4`, advertised a total length of 8,656,415
bytes, and began with an ISO Base Media File signature. This proves the single observed sample; it
does not prove that every Instagram result uses the same host family, redirect behavior, lifetime,
or required request headers.

No media URL, opaque resource content, raw Provider response, request marker, Cookie, or submitted
tracking parameter is committed to the repository.

## 2026-09-09 production smoke follow-up

The public Reel shortcode `DcSBz8UCbTG` resolved through SaveFromIns in NL with one normalized MP4
format, but the browser failed at secure Delivery with `DELIVERY_CANDIDATE_NOT_AVAILABLE`. The
sanitized task ledger recorded one successful Provider attempt and no successful transfer. The
exact `savefromins / instagram / nl` rollout rule was disabled by CAS (revision 10, allocation
zero) and all three SaveFromIns gates were closed. X, Admin, calibration, and other Providers were
left unchanged.

The database was inspected after the failure and contained no live candidate or ticket for the
task. Because candidates expire after four minutes, this check cannot prove whether cleanup had
already removed a previously inserted candidate. The result is therefore treated as an unresolved
Delivery-candidate lifecycle failure, not as evidence to widen the upstream or media-host policy.

The controlled re-test on 2026-09-09 reached the Provider again after CI passed, but the upstream
request timed out at the reviewed 15-second ceiling (`provider_timeout`). The exact rule was then
CAS-disabled at revision 12 and the three runtime gates were closed. Together with the earlier
Delivery-stage failure, this shows intermittent upstream reliability across both resolution and
Delivery; no new host policy, cookie, retry, or download mode is justified.

## Terms and data boundary

The public Terms and Privacy pages were reachable during review and stated a last-updated date of
2026-02-01. The Terms require authorization for processed content and prohibit automated means
contrary to unspecified usage guidelines; the reviewed pages did not provide an explicit automated
integration grant. The Privacy page says server logs can include IP address, request time, requested
URL, user agent, and routing information, with retention as needed for service, legal, or contractual
purposes.

TikDD therefore must transmit only the normalized page URL, never user Cookies or Instagram
credentials, and must not enable production traffic until the owner records an explicit
automated-use decision. The public URL submitted by a user is still disclosed to this upstream and
must be covered by TikDD's own privacy copy before activation.

## Decision

Status: **production no-go after failed qualification**.

SaveFromIns is the only Work Item 20 candidate that demonstrated a cookie-free, non-interactive
Instagram resolve and a deliverable MP4 response from NL. Its small production-disabled adapter,
sanitized fixtures, and deterministic CI coverage are now implemented and deployed.

The implementation review established items 2 through 5 below. The owner recorded item 1 and
authorized a bounded rollout on 2026-09-06. The first real browser task produced three sanitized
`invalid_result` attempts and no Delivery candidate, so the exact rule and all gates were disabled
immediately. Before another qualification attempt, the current upstream response and media-host
shape must be re-reviewed without broadening the Delivery boundary from an observed response alone:

1. explicit approval for TikDD's automated server-side use;
2. a bounded, evidence-backed Instagram media-host and redirect policy rather than trusting response
   hosts dynamically;
3. deterministic mappings for private, removed, unsupported, rate-limited, challenged, malformed,
   and schema-changed responses;
4. strict time, byte, redirect, concurrency, and retry ceilings; and
5. a disabled-by-default Manifest capability and rollout kill switch.

## Work Item 22 repair evidence

With the production rule and all three SaveFromIns gates disabled, two bounded diagnostics on
2026-09-06 returned HTTP 200, a success state, and one direct 720P MP4 for each owner-supplied Reel.
The second sample used a reviewed `cdninstagram.com` subdomain. The first used
`instagram.fsjc1-4.fna.fbcdn.net`, explaining the earlier `invalid_result` outcome under version 1.

The new host resolved only to public addresses. A 1 KiB HTTPS Range request returned HTTP 206,
`video/mp4`, a total length of 8,656,415 bytes, an ISO Base Media File signature, and no redirect.
ADR-0022 therefore adds only the label-boundary suffix `fna.fbcdn.net` to version 2; it does not
allow the parent `fbcdn.net` family or runtime host discovery. This evidence supports a code repair,
not production activation. Another real browser qualification still requires owner authorization.

## 2026-09-08 empty-quality compatibility incident

After the Instagram Beta entered production, the owner supplied the public Reel shortcode
`DZxoImOOKrZ` after TikDD returned its generic retryable failure. The sanitized production attempt
ledger recorded one `savefromins` / `instagram` / `nl` attempt ending in
`provider_schema_changed`. A separately authorized, bounded diagnostic from the production Worker
then received HTTP 200 with `status=1`, `status_code=success`, and two resources.

The response contained one direct MP4 video on a real `fna.fbcdn.net` subdomain, so the existing
ADR-0022 Delivery policy was sufficient. The video had an empty quality string. An unrelated audio
resource also had empty quality and download-mode fields and no valid download URL. The adapter
validated every resource before selecting direct MP4 video, so either incomplete sibling caused the
entire successful response to be classified as a schema change.

The compatibility repair keeps the response count ceiling and the existing request and Delivery
allowlists, validates resources independently, ignores malformed or irrelevant siblings, and maps
an empty video quality to `Original`. A successful Provider response with no valid direct MP4 is
now `invalid_result`; malformed JSON or a malformed response envelope remains
`provider_schema_changed`. No request marker, raw Provider response, submitted URL parameters, or
media URL is retained in this record.

## 2026-09-08 PR #64 production smoke follow-up

PR #64 was merged as `main@13a56f28fd03c9e9cf87966166b467cda6c47e5c` and deployed from the
GitHub-built images. Database migrations, the six core health checks, and the short post-deploy
watch completed without a core-service failure. The existing SaveFromIns/Instagram/NL rule and its
three activation gates remained enabled at full allocation for the owner-approved Beta.

The first post-deploy smoke did not reproduce a valid transfer. The supplied Reel `DZxoImOOKr`
returned a terminal `content_not_found` attempt. A previously successful Reel then returned
`invalid_result`; no new Delivery ticket or non-zero Instagram transfer was recorded in this
smoke. These outcomes are kept as sanitized attempt codes only; no raw Provider response, request
marker, Cookie, tracking parameter, or media URL is retained.

This evidence does not distinguish a removed/private Reel from an upstream response variant, so it
does not justify changing the adapter, adding a new download mode, accepting runtime-discovered
hosts, or widening the Delivery allowlist. Work Item 26 owns the next single bounded reproduction.
Until a current public Reel produces a verified direct MP4 and non-zero Delivery response,
Instagram remains Beta/noindex and no stable-support claim is made.
