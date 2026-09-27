# ADR-0050: SnapYT bounded YouTube provider-stream delivery

- Status: Accepted for Work Item 109 POC
- Date: 2026-09-27
- Extends: ADR-0003, ADR-0005, ADR-0036

## Context

TikDD has no production YouTube route. A bounded NL protocol review compared SnapYT, YTUltra, and
VD6S using two current public samples and at most 1 KiB media Range reads. VD6S requires an
interactive Turnstile token. YTUltra resolved both samples but only one produced a usable combined
MP4. SnapYT anonymously issued a short-lived result page containing both Googlevideo URLs and its
own force-download URLs. One same-session SnapYT sample returned `206 video/mp4` from both paths,
and the force-download response supplied attachment disposition; later requests also showed that
the upstream is short-lived and may time out or reject expired links.

A broad Googlevideo suffix would admit a large changing CDN surface while still failing to ensure a
download response or an audio track. The narrower SnapYT force-download URL has an exact host,
path, action, and bounded query shape. It streams from the Provider to the user's browser: TikDD's
NL API, Worker, and Delivery service still do not carry media bytes.

## Decision

Work Item 109 adds a disabled-by-default `snapyt-app / youtube` adapter and a versioned
`snapyt-app-youtube-media-v1` redirect policy.

The adapter performs exactly one sequential protocol flow:

1. fetch the SnapYT landing page and extract a bounded `VD_NONCE` value;
2. submit one form-encoded `process_video_url` request;
3. fetch the returned same-origin result page and normalize reviewed force-download links.

Only YouTube combined progressive MP4 itags 18 and 22 are accepted. Adaptive video-only, separate
audio, HLS, DASH, WebM, MP3, unknown itags, and direct Googlevideo URLs are excluded. Optional title,
thumbnail, size, and duration do not determine success.

The Delivery policy permits only HTTPS `www.snapyt.app`, exact path
`/wp-admin/admin-ajax.php`, exact `action=snapyt_force_download`, one non-empty `pid`, `fmt`, and
`nonce`, and no additional query keys. The generic Delivery policy schema now supports exact paths,
fixed query values, required query keys, and an optional complete query-key allowlist. Existing
policies retain their previous behavior through empty defaults.

Candidates expire after at most two minutes. They contain no Cookie or secret header. Browser
handoff is `navigate`; the Provider's attachment response is expected to trigger saving. Production
approval still requires two distinct no-Cookie, no-Referer browser downloads because the NL POC saw
transient timeouts and short-lived URLs.

The Worker allows one in-flight request by default, spaces starts by five seconds, emits only
sanitized phase/status/count/failure diagnostics, and never replays a YouTube task through BullMQ.
Fallback remains sequential, but YTUltra and VD6S are evidence-only and cannot enter the route.

## Consequences

- No public API, OpenAPI, database, Web, or result-contract change is required.
- Provider URLs, nonce values, source URLs, response bodies, and query strings remain outside logs
  and the public result.
- TikDD does not become a media proxy, converter, audio/video merger, or Provider-page relay.
- Expired or rejected force-download links require a new user task; Delivery does not call the
  Provider again.
- YouTube stays unavailable and non-indexable until its exact production route, browser delivery,
  content snapshot, and publication gates pass.

## Rollback

Keep `ENABLE_SNAPYT_PROVIDER=false`, remove or disable any `snapyt-app / youtube / nl` rollout rule,
and leave YTUltra and VD6S in Provider Lab. Existing platform routes are independent and unchanged.
