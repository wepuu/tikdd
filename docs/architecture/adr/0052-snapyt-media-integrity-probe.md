# ADR-0052: SnapYT media integrity probing before Delivery

- Status: Accepted for Work Item 111
- Date: 2026-09-27
- Extends: ADR-0050

## Context

SnapYT's result page labels force-download actions with YouTube format IDs, but a current NL
review returned an `audio/webm` response for one label that the adapter previously treated as a
combined MP4. A second public sample returned no reviewed combined candidate. A Provider label is
therefore not sufficient evidence for browser Delivery.

## Decision

Before creating a SnapYT Delivery candidate, the Worker performs a bounded validation request to
at most two reviewed force-download actions, ordered by quality. The request is a `GET` with
`Range: bytes=0-1023`, no user Cookie or Referer, and cancels the body after the first bounded
chunk. A candidate is accepted only when the response is `200/206`, `video/mp4`, non-empty, and
marked `Content-Disposition: attachment`. Audio, WebM, HTML, redirects, empty responses and
unreviewed statuses are rejected as `invalid_result`; provider rate limits, challenges and
timeouts retain their typed fallback errors.

The existing exact SnapYT host/path/query policy is unchanged. The probe is validation only: TikDD
does not proxy, cache, persist or return media bytes. The resulting one-use Delivery ticket still
redirects the user's browser to the reviewed Provider action.

## Routing consequence

NoAdsDL remains the YouTube primary at priority 740. SnapYT is the sequential fallback at priority
720. Both require independent gates, rollout rules and browser audits. Queue replay remains off,
and a terminal private/deleted-content error does not invoke the fallback.
