# SaveFromIns provider feasibility record

- Candidate ID: `savefromins` (research only; not a registered Provider)
- Site: <https://savefromins.com/>
- Evaluated platform: Instagram
- Evaluated region: `nl`
- Review date: 2026-09-06
- Production approval: not established
- Manifest capability: none
- Delivery policy: none
- Runtime state: absent and disabled

## Public workflow observed

The public page completed with HTTP 200 and exposed a browser-side form submission to an HTTPS API
on `api.savefromins.com`. The request accepted a canonical public Instagram link without an account
Cookie, Instagram `sessionid`, CAPTCHA, or interactive challenge. Its front-end request marker is
treated as Provider protocol detail and is not recorded as a TikDD credential or public contract.

The project owner supplied two public Reel samples. TikDD removed the `utm_source` and `stkn` query
parameters and submitted the first canonical URL once from the NL environment. The API returned
HTTP 200 with a success state, one normalized-looking `720P` MP4 resource, and a direct candidate on
`scontent-bos5-1.cdninstagram.com`. The second sample was not sent because the first established a
clear success path.

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

Status: **conditional technical go; production no-go pending review**.

SaveFromIns is the only Work Item 20 candidate that demonstrated a cookie-free, non-interactive
Instagram resolve and a deliverable MP4 response from NL. It may be used for a small,
production-disabled adapter implementation with sanitized fixtures and no live CI dependency.

Before qualification or traffic, the implementation review must establish:

1. explicit approval for TikDD's automated server-side use;
2. a bounded, evidence-backed Instagram media-host and redirect policy rather than trusting response
   hosts dynamically;
3. deterministic mappings for private, removed, unsupported, rate-limited, challenged, malformed,
   and schema-changed responses;
4. strict time, byte, redirect, concurrency, and retry ceilings; and
5. a disabled-by-default Manifest capability and rollout kill switch.
