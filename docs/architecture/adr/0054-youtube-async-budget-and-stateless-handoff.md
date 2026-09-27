# ADR-0054: YouTube asynchronous budget and stateless handoff boundary

## Status

Accepted for Work Item 113.

## Context

The first production request after Work Item 112 proved that both YouTube adapters were selected,
but neither completed the route. NoAdsDL accepted the sparse format schema, selected a combined
MP4 and created one asynchronous job, then remained in processing through ten polls and exhausted
the previous route budget. SnapYT parsed its result page and reviewed multiple force-download
descriptors, but every descriptor returned a redirect rather than media bytes.

A bounded NL protocol review then observed two NoAdsDL jobs complete after about four seconds,
showing that the earlier timeout was generation-latency variation rather than a parser failure.
The same review observed SnapYT redirect without Cookie dependence through
`redirector.googlevideo.com` to a dynamic Googlevideo host, where the media request returned 403.
That redirect surface is broader and less stable than the accepted Provider-stream policy.

## Decision

- NoAdsDL keeps one metadata request and one job creation. Polling is governed by a 40-second time
  budget and a hard ceiling of twenty status requests rather than a ten-poll completion assumption.
  Its Provider timeout is 45 seconds. No BullMQ replay or second Provider job is allowed.
- The shared YouTube route receives a 75-second floor and the Web polls YouTube tasks for 90
  seconds. Other platform budgets are unchanged.
- A completed NoAdsDL job without a reviewed media URL is schema drift, not a timeout. Diagnostics
  record only bounded status/progress categories, poll count and elapsed time.
- SnapYT redirects remain rejected by `snapyt-app-youtube-media-v1`. TikDD does not add a broad
  `*.googlevideo.com` allowlist, follow the dynamic chain in Delivery, or treat a final 403 as a
  browser-downloadable result. The SnapYT rollout remains closed until a future stateless,
  versioned delivery boundary is independently qualified.
- When an adapter returns a typed Provider failure at the same time as the shared route deadline,
  the explicit failure is retained in the attempt ledger and task result. Only an abort without a
  typed Provider decision becomes `provider_timeout`.

## Consequences

No public API, database schema, media proxy, stream merger, Provider-page handoff or source-CDN
allowlist is introduced. NoAdsDL may be qualified independently while SnapYT remains unavailable.
Separate audio and video resources remain permitted only when a Provider supplies a stateless,
reviewed attachment response.

## Rollback

Keep both `noadsdl / youtube / nl` and `snapyt-app / youtube / nl` rollout rules disabled with zero
allocation. Revert the application release if the longer bounded task window causes Worker or Web
regressions; no persistence rollback is required.
