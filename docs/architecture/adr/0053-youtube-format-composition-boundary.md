# ADR-0053: YouTube format composition boundary

## Status

Accepted for Work Item 112.

## Context

The current free YouTube providers do not expose one stable format schema. NoAdsDL currently
returns a sparse `video_formats` map whose keys identify combined MP4 resolutions, while its
audio formats are a separate map. SnapYT exposes force-download descriptors where `fmt` is a
provider format identifier rather than a YouTube `itag`; the same result page can contain one
combined 360p MP4 and separate video or audio resources. A label alone is not sufficient to prove
the bytes returned by the force-download endpoint.

## Decision

- NoAdsDL accepts both its previously reviewed codec-rich schema and the current sparse combined
  MP4 schema. The parser requires a bounded format identifier and a resolution/MP4 key, while
  title, bitrate and size remain optional metadata.
- NoAdsDL keeps the original status URL across asynchronous responses that omit `status_url` while
  a job remains `queued`, `pending`, `processing` or `running`. Polling remains bounded and
  same-host.
- SnapYT accepts bounded numeric `fmt` values, including the observed combined `fmt=0` fallback,
  but keeps the exact action, path and query-key Delivery policy. It probes at most five candidate
  endpoints sequentially and classifies each response from the actual MIME type and nearby label:
  `combined`, `video-only` or `audio-only`.
- Only `video/*`, `audio/*` and the reviewed attachment response shape are accepted. Unsupported
  MIME types, empty bodies, redirects, challenges and failed probes do not create candidates.
- Separate streams are surfaced as clearly labeled downloadable formats. TikDD does not merge,
  transcode, proxy or download complete media on the server. The 360p combined MP4 remains the
  only format that can be expected to contain both tracks when a provider offers it.

## Consequences

The result may contain multiple formats with explicit `video-only` or `audio-only` labels. A
browser can download those resources independently, but TikDD does not promise client-side
composition. Provider diagnostics record only counts and sanitized response categories. The
existing NoAdsDL primary/SnapYT sequential fallback and all three gates remain unchanged; this ADR
does not authorize production activation.
