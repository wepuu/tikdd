# Work Item 107 — AnyLoader xHamster POC closeout

Status: rejected for the current TikDD delivery architecture (2026-09-26)

## Objective

Evaluate AnyLoader as a possible xHamster secondary Provider without introducing a server
media proxy. The POC was intentionally stopped before an adapter, Delivery policy, gate, or
rollout rule was created.

## Protocol evidence

The public xHamster page exposes a Nuxt application that lists xHamster as a backend-supported
platform. Its client calls the following anonymous endpoint:

```text
POST https://anyloader.com/api/v1/proxy/fetch
```

The request contains a canonical xHamster page URL and a small, fixed browser-like header set.
No API key, account Cookie, login, persistent token, or CAPTCHA token was required in the
bounded NL probe. The response is a wrapper with an upstream status and HTML body; a future
adapter would have to validate both statuses rather than trusting the outer HTTP 200.

Using the frontend's request headers, one public sample produced an upstream HTTP 200 HTML
response of approximately 338 KiB. The page contained both HLS and progressive MP4 candidates
on the reviewed `*.xhcdn.com` suffix. A maximum of 1 KiB was read from each of five candidates:

- one candidate returned `206 application/vnd.apple.mpegurl` and `Access-Control-Allow-Origin: *`;
- four candidates returned `206 video/mp4` and accepted Range requests;
- the progressive MP4 candidates did not return `Access-Control-Allow-Origin` or
  `Content-Disposition: attachment`.

The first probe with incomplete browser headers produced a nested upstream 520. This confirms
that the hosted endpoint is sensitive to request shape and is not a stable public Developer API.
The successful request still does not qualify the Provider for production: a 302/navigation
handoff would open the MP4 player, while the existing browser-owned Blob handoff cannot read the
progressive resources without CORS. The HLS candidate would require a new client-side playlist,
segment, and container assembly path.

## Decision

The POC failed the required browser-save boundary. AnyLoader is rejected for this work item and
is not added to `@tikdd/providers`, `FREE_PROVIDER_PORTFOLIO`, the Delivery host-policy table,
environment gates, rollout rules, or production routing.

No server-side media relay, Provider-page handoff, HLS stitching, Service Worker, or File System
Access API was introduced. The candidate may be reconsidered only if AnyLoader exposes an
explicit anonymous progressive-MP4 endpoint with a reviewed download/CORS contract, or if a
separate client HLS delivery design is explicitly approved.

## Operational impact

- GetXHamster remains the active xHamster primary route.
- 9xBuddy remains disabled after its conversion timeouts.
- LocoLoader remains the existing bounded fallback.
- No database migration, public contract, SEO change, image build, or production deployment
  is required for this closeout.

Temporary probe files and response bodies were kept outside the repository and removed after
the test. The repository contains no sample URL, response body, token, Cookie, or complete media
URL.
