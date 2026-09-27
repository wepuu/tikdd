# Work Item 109 — SnapYT YouTube Beta POC and Delivery audit boundary

## Outcome

TikDD now contains a disabled-by-default SnapYT YouTube adapter and a strict provider-stream
Delivery policy. This is an implementation POC, not a production activation: no rollout rule was
created, no gate was enabled, no production traffic changed, and YouTube remains outside public
search publication.

## Qualification evidence

The 2026-09-27 NL review used two public sample aliases without retaining their URLs or upstream
responses in the repository.

| Candidate | Result | Delivery evidence | Decision |
| --- | --- | --- | --- |
| SnapYT | anonymous nonce/AJAX/result flow resolved; one full same-session sample produced 22 candidates | direct and force-download paths returned `206 video/mp4`; force path supplied attachment disposition; later requests showed expiry/timeouts | implement default-off POC |
| YTUltra | anonymous JSON API returned six MP4 entries for each sample | only one sample's 360p MP4 returned `206`; the other sample's 1080p and 360p returned 403 | evidence-only |
| VD6S | page and multi-platform protocol were reachable | analysis requires an interactive Turnstile token | rejected/blocked |

The probe read at most 1 KiB per media response, downloaded no complete video, touched no production
configuration, and removed its `/tmp` artifacts from the NL host.

## Implementation

- `snapyt-app` exposes only the `youtube` manifest capability at priority 720.
- The runtime sequence is landing page, one AJAX resolve, then one same-origin result page.
- Only combined MP4 itags 18/22 are normalized; direct Googlevideo, adaptive, audio-only, HLS, DASH,
  WebM, unknown, duplicate, and malformed candidates are discarded.
- `snapyt-app-youtube-media-v1` permits one exact host/path/action/query shape and uses normal
  one-use redirect tickets with a two-minute candidate ceiling.
- Three default-off activation gates, one in-flight request, a configurable request interval,
  sanitized diagnostics, one queue execution, circuit isolation, and platform/region rollout
  isolation preserve the existing operational boundary.
- Provider Lab records SnapYT as `resolved` but delivery-unverified, YTUltra as unresolved for
  production delivery, and VD6S as challenge-blocked.

ADR-0050 records the new exact-query Delivery policy and Provider-stream decision. No database,
OpenAPI, public contract, Web, Admin command, media proxy, conversion, or SEO change is included.

## Verification and remaining live gate

Fixtures cover nonce extraction, response failure decisions, combined-format selection,
deduplication, spoofed hosts, HTTP, credentials, custom ports, wrong paths/actions, missing and extra
query keys, diagnostics redaction, activation gates, no queue replay, and production-route default
closure. CI must pass targeted Vitest, `pnpm check`, shell syntax, Compose rendering, and
`git diff --check`.

Production qualification remains intentionally pending. It requires an exact-SHA deployment,
backup, explicit gate activation, a unique `snapyt-app / youtube / nl` rollout rule, and two distinct
browser downloads proving that the no-Cookie/no-Referer redirect still saves playable MP4 files
with audio. A failed sample disables the rule and gates; it does not widen the host policy or add a
TikDD media relay.
