# Work Item 58 — Instagram API Provider technical batch

Status: complete as an evidence-only batch (2026-09-13)

## Scope

The three owner-supplied candidates were tested from the NL VPS using the stated protocol shapes,
not marketing-page claims. Each candidate received one primary public Reel request. The best first
result, Prexzy, received one confirmation Reel request. Prexzy's internal endpoints were called
sequentially and stopped only on a success or a terminal classification; no parallel calls or
automatic retries were used.

The probe enforced HTTPS, a 10-second request limit, bounded response size, no user Cookie/login/
API key/browser token, and one-kilobyte Range validation for returned media. Raw response bodies,
source URLs, query strings, credentials, and complete CDN URLs were discarded. Only structural key
paths, statuses, counters, timings, and the media-host suffix were retained.

## Sanitized NL observations

| Provider | Protocol result | Media check | Decision |
| --- | --- | --- | --- |
| `ahm7_alldl` | `GET /api/alldl` timed out at the 10-second boundary; no response body or Cookie | 0 resources, 0 valid MP4 | `deferred` — `network_error` |
| `prexzy` (primary sample) | `/download/igv2`: HTTP 200 JSON, no media; `/download/instagram`: timeout; `/download/aiov2`: HTTP 200 JSON with one media result. Observed key paths were recorded without values. | 1 media resource passed HTTPS/public-DNS checks and `Range: bytes=0-1023` returned `206 video/*`; only the `cdninstagram.com` suffix was retained | `resolved` for the first sample |
| `prexzy` (confirmation sample) | `/download/igv2`: HTTP 200 JSON, no media; `/download/instagram` and `/download/aiov2`: timeout | 0 valid MP4 | Confirmation failed; overall candidate is not `qualified` |
| `cliplatch` | `POST /api/parse` timed out at the 10-second boundary; no response body or Cookie | 0 resources, 0 valid MP4 | `deferred` — `network_error` |

Prexzy's first endpoint returned a real JSON shape containing `results` and media-related fields but
no usable video URL for this sample. Its third endpoint returned one valid video result. Because the
second sample did not complete, the candidate remains `technicalState=resolved` and is not eligible
for implementation or routing. No ClipLatch retry was made, so its documented rate limit was not
approached.

## Repository outcome

- `provider:preflight` now maps `ahm7_alldl`, `prexzy` and `cliplatch` to their reviewed protocol
  endpoints.
- `FREE_PROVIDER_PORTFOLIO` records AHM7 and ClipLatch as temporarily reachable/unverified and
  Prexzy as resolved but unqualified. All three remain disabled and resolution-only.
- Tests cover the new IDs, endpoint mappings and qualification states.
- No Adapter, response fixture, Delivery host policy, environment gate, rollout rule, migration,
  Admin change or production deployment was added. A raw fixture was intentionally not committed
  because the confirmation gate failed; a future Adapter task must recapture and sanitize exact
  success/failure fixtures without guessing the schema.
- The temporary NL probe was removed from both the VPS and the repository.

SaveFromIns remains the only Instagram production Provider. This batch does not change Instagram
traffic, X/TikTok/SnapTik/TikCD, Admin or calibration. A future implementation should not promote
Prexzy until two independent samples pass and its internal fallback is bounded by one overall route
budget.
