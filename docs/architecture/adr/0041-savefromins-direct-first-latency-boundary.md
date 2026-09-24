# ADR-0041: SaveFromIns direct-first latency boundary

## Status

Accepted for Work Item 92. Production Instagram traffic remains disabled until the updated image
passes the bounded NL and browser verification.

## Context

The current SaveFromIns web client still submits an anonymous form to the reviewed parse endpoint,
but its UI now supports two result paths: a direct `download_url`, or an asynchronous
`resource_content` download that calls a second endpoint and may continue through an SSE task. Four
current public Reel samples returned a direct MP4 in the top-level resource list. The same responses
also contained audio or popup-oriented siblings that are not required for the direct browser path.

The samples completed between sub-second and roughly twenty seconds. TikDD's ten-second Provider
timeout therefore classified some valid upstream responses as `provider_timeout`, while the public
client allows a longer request window. The existing one-attempt and Delivery host boundaries remain
necessary because SaveFromIns applies frequency controls and the NL route is not a general proxy.

## Decision

- Set the SaveFromIns manifest timeout to 25 seconds, below the existing 30-second route deadline.
- Keep one queue execution and no automatic Provider replay.
- Prefer valid top-level direct MP4 resources when both direct and popup/nested siblings are present.
- Do not add the asynchronous `/media/download` or SSE flow until a future qualification batch proves
  that direct resources are absent for a supported Instagram task class; it is not needed for the current
  Reel evidence.
- Add only sanitized response-header, body-read, and total-duration timings to internal diagnostics.
- Keep `savefromins-instagram-media-v2`, one-use Delivery tickets, DNS validation, and browser-direct
  media delivery unchanged.

## Release boundary

The existing unique Instagram/NL rule stays disabled during deployment. After the exact image is
verified, two distinct public Reels must each complete one Provider attempt, one ticket, a reviewed
302, and a non-zero browser download. A timeout beyond 25 seconds, challenge, rate limit, or invalid
Delivery target closes the rule again; it does not increase retries or widen the host policy.
