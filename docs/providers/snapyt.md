# SnapYT YouTube Provider

## Capability

- Provider ID: `snapyt-app`
- Platform: `youtube`
- Region: NL, with local/global fixture support
- Content: public individual YouTube videos and Shorts
- Accepted media: bounded force-download resources; combined MP4, video-only, and audio-only
  streams are labeled from the verified response
- State: implemented fallback adapter, disabled by default, browser Delivery audit pending

Playlists, private/member/paid/age-restricted content, live streams, DRM, HLS, DASH and
conversion are outside this adapter. Separate audio/video resources are accepted only as explicit
individual downloads; TikDD does not merge or transcode them. The observed combined `fmt=0` 360p
MP4 is supported alongside the reviewed numeric format identifiers.

## Protocol

The adapter fetches `https://www.snapyt.app/`, extracts the bounded page nonce, submits one
form-encoded request to `/wp-admin/admin-ajax.php` using action `process_video_url`, and fetches the
same-origin result page returned by the JSON envelope. It does not use a user Cookie, account,
browser storage Token, CAPTCHA, headless browser, or retry loop.

The parser ignores direct Googlevideo fields. It accepts only force-download URLs that match the
versioned `snapyt-app-youtube-media-v1` policy and have a bounded numeric `fmt` (including `0`).
Before creating candidates, the Worker validates at most five force-download responses
sequentially with a 1 KiB Range probe and requires `200/206`, a recognized `video/*` or `audio/*`
MIME type, non-zero bytes, and `Content-Disposition: attachment`. Nearby labels are used only as
composition hints; the actual response MIME type wins. Upstream URLs and nonce values remain
internal and are encrypted with the normal Delivery candidate mechanism.

## Runtime controls

- `ENABLE_SNAPYT_PROVIDER=false`
- `SNAPYT_TERMS_APPROVED=false`
- `SNAPYT_DELIVERY_AUDIT_APPROVED=false`
- `SNAPYT_MAX_CONCURRENCY=1` (`1..2`)
- `SNAPYT_MIN_INTERVAL_MS=5000` (`0..60000`)

All three gates must match before the production Worker can register the Provider. A unique
`snapyt-app / youtube / nl` rollout rule is additionally required. Queue replay is disabled and
each YouTube job has one execution.

NoAdsDL is the YouTube primary at priority 740; SnapYT remains the sequential fallback at priority
720. Both routes have independent gates and rollout rules.

## Error decisions

- private, members-only, login, and age-restricted responses: terminal `content_private`;
- removed/deleted/unavailable responses: terminal `content_not_found`;
- invalid, unsupported, and playlist responses: non-retryable `unsupported_url`, fallback allowed;
- 429 or explicit capacity text: retryable `provider_rate_limited`, fallback allowed;
- network, timeout, 5xx, challenge, invalid JSON, missing result page, and schema drift: sanitized
  Provider failures, fallback allowed;
- no reviewed numeric target, unsupported MIME response, missing attachment disposition, empty
  response, or rejected media probe: non-retryable `invalid_result`, fallback allowed.

The diagnostic event contains only task ID, platform, phase, HTTP status, content-type category,
candidate/accepted/composition/rejection counts, failure code, and duration. It never contains
source or result URLs, titles, response bodies, Cookies, nonce values, media hosts, or query
parameters.

## Production audit

After an exact-SHA deployment with the route still disabled, enable the three gates, recreate only
the Worker through the official release script, and create one exact rollout rule. Two distinct
public samples must each produce one attempt, pass the media probe, yield a one-use ticket, an
audited 302, an attachment save, and a non-zero playable MP4 with audio in a real browser. Any
failure disables the rollout first and then the three gates. NoAdsDL remains the primary YouTube
route and SnapYT is used only after a fallback-eligible primary failure.
