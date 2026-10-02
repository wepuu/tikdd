# Work Item 136: optional Cobalt TikTok thumbnail enrichment

## Scope

Work Item 136 adds best-effort preview metadata to successful Cobalt TikTok resolutions without
changing media resolution, routing or delivery. The enrichment uses TikTok's fixed official
`https://www.tiktok.com/oembed` endpoint. It is not a new Provider and does not own a rollout rule,
Delivery candidate or media Host policy.

## Reviewed source boundary

Two previously approved public TikTok samples were checked sequentially from NL. Both oEmbed
requests returned HTTP 200 JSON without redirects, and both exposed a thumbnail on the exact host
`p16-common-sign.tiktokcdn-eu.com`. A one-kibibyte Range check returned HTTP 206, `image/jpeg` and
non-zero content for both images without a redirect.

The version-one runtime allowlist therefore accepts only that exact image host. It does not accept
the parent domain, arbitrary subdomains, similar suffixes or the different host shown in generic
documentation examples. The URL must use HTTPS and the default port without credentials; fragments
are removed and signed query parameters are preserved. A later host rotation requires new bounded
evidence and a code review rather than an automatically widened suffix rule.

## Fail-open metadata behavior

Cobalt must first return a valid, capability-verified media result. Only then does the adapter try
the official oEmbed request with an independent three-second timeout, a 64-KiB streaming response
limit, at most three same-host redirects, no credentials and no retry. Accepted JSON contributes
only `thumbnail_url`; no oEmbed HTML, title or author data crosses the Provider boundary.

Every enrichment failure returns `null` rather than throwing. This includes timeout, cancellation,
HTTP errors, rate limiting, invalid JSON, schema drift, an oversized response, missing metadata and
an unreviewed thumbnail host. The already normalized Cobalt formats and encrypted Delivery
candidates remain unchanged, so the router records a successful Cobalt attempt and the Web falls
back to its TikTok platform icon if the image is absent or later fails to load.

Internal `tiktok_thumbnail_diagnostic` events contain only the task ID, phase, bounded status,
HTTP status, content-type category, redirect count and duration. They never contain source URLs,
thumbnail URLs, complete hosts, query values, response bodies, titles, cookies or headers.

## Validation and release boundary

Tests cover the exact host rule, spoofed hosts, HTTP, credentials, custom ports, fragments,
successful enrichment, missing metadata, invalid and oversized JSON, wrong content type, 404,
429, 5xx, unsafe redirects, timeout, diagnostic isolation and Cobalt success preservation. Web
regression coverage confirms a failed image falls back without changing the result.

No OpenAPI, contract, database, route priority, environment gate or Delivery policy changes are
required. Production deployment is separate: deploy exact-SHA GitHub images while keeping the
existing SnapTik, TikCD and priority-450 Cobalt routes unchanged, then use one approved temporary
Cobalt-only browser check and restore the primaries regardless of thumbnail outcome.
