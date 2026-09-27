# NoAdsDL YouTube Provider

## Capability

- Provider ID: `noadsdl`
- Host: `noadsdl.com`
- Platform: YouTube
- State: implemented Beta adapter, disabled by default, Delivery audit pending
- Content: public individual videos and Shorts; private, member-only, age-restricted, live, DRM,
  playlists and adaptive-only streams are out of scope

## Protocol

The adapter calls `GET /api/video-info` with the canonical URL, selects one free combined MP4,
then calls `GET /download?format=mp4&format_id=...&async=1`. If the Provider queues the job, TikDD
polls its same-host status URL at most ten times before accepting a reviewed generated-file path.
The parser tolerates missing optional title and format metadata but requires a format identifier
and a combined MP4.

The only Delivery target is the versioned `noadsdl-youtube-media-v1` policy. Provider stream URLs
remain encrypted internal candidates; they are never returned in the public resolve result and
TikDD does not proxy, cache or read the media body.

## Runtime controls

```text
ENABLE_NOADSDL_PROVIDER=false
NOADSDL_TERMS_APPROVED=false
NOADSDL_DELIVERY_AUDIT_APPROVED=false
NOADSDL_MAX_CONCURRENCY=1
NOADSDL_MIN_INTERVAL_MS=5000
NOADSDL_POLL_INTERVAL_MS=2000
NOADSDL_MAX_POLLS=10
```

All gates must be true before the Worker registers the adapter. A unique `noadsdl / youtube / nl`
rollout rule and two real browser downloads are required before production traffic. Queue replay
is disabled because each YouTube job is already bounded to one Provider attempt.

## Evidence and failure handling

Two public samples resolved through the anonymous API and returned a Provider-hosted MP4 stream;
the result is `resolved`/Delivery-conditional, not a source-CDN qualification. Diagnostics expose
only phase, HTTP status, content type, format and poll counts, failure code and elapsed time. They
never include source URLs, response bodies, cookies, tokens, query values or media URLs.
