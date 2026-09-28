# NoAdsDL YouTube Provider

## Capability

- Provider ID: `noadsdl`
- Host: `noadsdl.com`
- Platform: YouTube
- State: implemented Beta adapter, disabled by default in source and independently gated in production
- Content: public individual videos and Shorts; private, member-only, age-restricted, live, DRM,
  playlists and adaptive-only streams are out of scope

## Protocol

The adapter calls `GET /api/video-info` with the canonical URL, normalizes and de-duplicates the
free combined MP4 offers, then calls `GET /download?format=mp4&format_id=...&async=1` sequentially
for at most two preferred formats. The parser accepts both the original
codec-rich response and the current sparse `"720p MP4"` map, where `format_id` is required but
title, bitrate, size and other optional metadata may be absent. If the Provider queues the job,
TikDD polls its same-host status URL within one shared 40-second and twenty-request budget; a processing response may omit
`status_url`, in which case the original reviewed status URL is retained. Only a ready generated
file path becomes a candidate. The primary format must succeed; optional secondary failure keeps
the primary result. A thumbnail is retained only from exact reviewed YouTube image hosts.

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
NOADSDL_POLL_BUDGET_MS=40000
NOADSDL_MAX_PREPARED_FORMATS=2
```

All gates must be true before the Worker registers the adapter. A unique `noadsdl / youtube / nl`
rollout rule and two real browser downloads are required before production traffic. Queue replay
is disabled; each task makes one bounded Provider attempt containing no more than two sequential
generation jobs.

## Evidence and failure handling

Two public samples resolved through the anonymous API and returned a Provider-hosted MP4 stream;
the result is `resolved`/Delivery-conditional, not a source-CDN qualification. Diagnostics expose
only phase, HTTP status, content type, eligible/requested/prepared/skipped format counts, thumbnail
acceptance, bounded job-status/progress categories, sanitized secondary failure code and elapsed time. They
never include source URLs, response bodies, cookies, tokens, query values or media URLs.
