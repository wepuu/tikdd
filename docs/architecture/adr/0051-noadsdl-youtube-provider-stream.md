# ADR-0051: NoAdsDL bounded YouTube provider-stream delivery

- Status: Accepted for Work Item 110 POC
- Date: 2026-09-27

## Context

NoAdsDL exposes an anonymous `video-info` endpoint and a bounded asynchronous free-download
workflow. A successful response prepares an MP4 on the Provider host and returns a short-lived
same-origin file path. The two reviewed YouTube samples were repeatable, but delivery is a
Provider stream rather than a source-platform CDN redirect: the response is an octet stream with
attachment metadata and no browser CORS contract.

## Decision

TikDD adds a disabled-by-default `noadsdl / youtube` adapter. It accepts only public individual
YouTube URLs and only free combined MP4 formats. The adapter performs one metadata request, one
job request, and at most ten status polls with a conservative interval. Cookies returned by the
Provider are kept only for that in-memory request sequence; user cookies, login, CAPTCHA and
browser tokens are never accepted.

Delivery uses the versioned `noadsdl-youtube-media-v1` redirect policy. Only HTTPS
`noadsdl.com/api/free-download/file/<opaque-token>` targets are accepted; query strings,
credentials, ports, lookalike hosts and status paths are rejected. The browser follows the
Provider stream and TikDD never reads or proxies media bytes. YouTube remains non-indexable and
the gates, rollout rule and browser audit are required before any production use.

## Consequences

- NoAdsDL is a separate route from SnapYT; fallback is sequential and queue replay is disabled.
- Provider-side generation and rate limits are visible operational risks, so the adapter records
  only sanitized phase/status/count/failure diagnostics.
- A future CORS or direct-CDN change requires a new policy version and a new browser audit rather
  than widening this allowlist.
