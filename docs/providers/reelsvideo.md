# ReelsVideo provider feasibility record

- Candidate ID: `reelsvideo` (research only; not a registered Provider)
- Site: <https://reelsvideo.io/>
- Evaluated platform: Instagram
- Evaluated region: `nl`
- Review date: 2026-09-06
- Production approval: not established
- Manifest capability: none
- Delivery policy: none
- Runtime state: absent and disabled

## Public workflow observed

The public landing request completed with HTTP 200 and selected `/en-4`. The page exposed an HTMX
submission boundary using `data-hx-post="/"` and the fields `id`, `locale`, `tt`, `ts`, and
`cf-turnstile-response`. It advertised downloads for public Instagram content without login, but
also loaded Cloudflare Turnstile and did not expose a reviewed terms or automated-integration grant
in the evaluated page.

One bounded NL probe submitted the synthetic unavailable URL
`https://www.instagram.com/reel/TikDDFeasibilityInvalid/` with provider-issued landing cookies and
the page's non-secret form fields. No account cookie, credential, CAPTCHA solution, or user data was
provided. The submission returned HTTP 429 with an empty JSON response before any downloadable
result or candidate host was established.

After the project owner supplied two public Reel samples, TikDD stripped the `utm_source` and
`stkn` query parameters and submitted the first canonical URL once. The real sample produced the
same HTTP 429 and empty JSON response. The second sample was not sent because the first result
already confirmed the interactive challenge boundary.

TikDD did not retry the rate-limited request, solve or bypass Turnstile, contact a media candidate,
or infer delivery safety from page copy.

## Decision

Status: **no-go for the current server-side adapter model**.

The interactive anti-automation dependency and HTTP 429 response make this candidate unsuitable
for the general TypeScript Worker. No exact media-host allowlist, redirect behavior, MIME/Range
behavior, link lifetime, or production-use permission was established. Adding it would either fail
closed in normal operation or require challenge bypass, which is prohibited.

Reconsider only if the Provider offers a documented cookie-free and non-interactive endpoint,
explicit automated-use permission, and stable media hosts that can pass the existing redirect,
DNS, MIME, Range, expiry, and one-use Delivery tests.
