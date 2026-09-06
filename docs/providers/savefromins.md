# SaveFromIns provider feasibility record

- Provider ID: `savefromins`
- Site: <https://savefromins.com/>
- Evaluated platform: Instagram
- Evaluated region: `nl`
- Review date: 2026-09-06
- Production approval: automated-use decision recorded; route qualification failed and traffic is disabled
- Manifest capability: Instagram in `nl`, disabled by default
- Delivery policy: `savefromins-instagram-media-v1`
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
