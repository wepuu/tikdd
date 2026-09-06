# Work Item 20: Instagram Provider feasibility

- Status: complete — conditional technical go
- Date: 2026-09-06
- Repository baseline: `main@3f22e1c`
- Production impact: none

## Objective

Evaluate DLPanda first, `reelsvideo.io` second, and the owner-supplied `savefromins.com` fallback as
possible public Instagram download Providers. Keep X production unchanged and do not create an
Instagram adapter, rollout rule, public support claim, landing page, or indexing state unless one
candidate establishes a safe delivery path.

## Evaluation boundary

- Public content only; no login, user Cookie, Instagram `sessionid`, or private-media access.
- Exact page hosts and bounded HTTP requests from the NL environment.
- No CAPTCHA or Cloudflare challenge bypass.
- No media transfer until an explicit candidate host can pass Delivery review.
- Sanitized evidence only; provider tokens, response bodies, cookies, and upstream URLs are not
  committed.

## Reviewed samples

The owner supplied two public Reels. TikDD removed the `utm_source` and `stkn` query parameters
before any Provider submission:

- `https://www.instagram.com/reel/Dc1dvJos2zj/`
- `https://www.instagram.com/reel/Dc6COPcKfV1/`

The first canonical sample was enough to produce decisive results. The second was retained as a
future fixture/canary candidate and was not transmitted during this review.

## Results

### DLPanda

Decision: no-go.

The project owner independently tested DLPanda and confirmed that it does not support Instagram in
a usable TikDD flow. The current page uses a separate POST/CSRF implementation, exposes an optional
`ig-sessionid` field, and did not establish a public downloadable result in the bounded unavailable-
URL check. Requiring or accepting `sessionid` is outside TikDD's public API and credential boundary.
The existing DLPanda Manifest therefore continues to exclude Instagram.

### ReelsVideo

Decision: no-go for the current server-side adapter model.

The NL landing request succeeded, but the submission contract included
`cf-turnstile-response`. A single synthetic unavailable-URL submission returned HTTP 429 with no
result body or media candidate. One later submission of the first reviewed real sample produced the
same HTTP 429 and empty response. No retry or challenge bypass was attempted. Without a stable
non-interactive submission path, approved automated-use boundary, and observable media hosts,
ReelsVideo cannot receive a Manifest capability or Delivery policy.

### SaveFromIns

Decision: conditional technical go; production approval pending.

The first reviewed canonical sample resolved from NL without an account Cookie, Instagram
`sessionid`, CAPTCHA, or interactive challenge. The response contained one `720P` MP4 candidate on
the observed `scontent-bos5-1.cdninstagram.com` host. A bounded public-DNS and 1 KiB Range check
followed no redirect and returned HTTP 206, `video/mp4`, a non-zero total size, and an MP4-compatible
file signature.

The single successful sample establishes adapter feasibility but not a complete Delivery allowlist.
The public Terms do not provide an explicit automated-integration grant, and the Privacy page says
submitted URLs and request metadata may be logged. Production therefore remains closed until the
automated-use decision, privacy disclosure, and bounded Instagram CDN host/redirect policy are
reviewed. See [the candidate record](providers/savefromins.md).

## Outcome

SaveFromIns was selected only as the technical candidate for a production-disabled Work Item 21
adapter slice. This is not Provider qualification or authorization to enable Instagram traffic.
Work Item 21 may implement deterministic fixtures, normalized results and errors, strict request
bounds, Manifest/routing integration, and disabled configuration. Qualification remains blocked on
the explicit automated-use and Delivery-host decisions recorded above.

X Public Beta, its rollout rule, circuit, and production containers were not changed. No Instagram
Manifest capability, rollout rule, public support claim, landing page, or indexing state was added.
Admin and calibration remain stopped.
