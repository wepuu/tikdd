# Work Item 103 — 9xBuddy empty-extract recovery

## Status

Implemented locally from `main@10e166c`; production remains unchanged pending PR and deployment.

## Production evidence and root cause

After Work Item 102 restored the public browser Origin, three consecutive xHamster tasks reached
9xBuddy. Each attempt completed bootstrap and token acquisition, received HTTP 200 JSON from
`/extract`, and then failed in 123–1,187 ms with zero normalized formats. The adapter mapped this
empty extraction shape to `unsupported_url`, which produced the misleading public private/removed/
unsupported message. Because LocoLoader is not currently eligible in production, no second
Provider attempt existed.

A separate bounded NL probe of the previously authorized public reference sample used the same
current bootstrap, token, signature, and `/extract` protocol and returned seven formats, including
MP4 options. This confirms that the 9xBuddy protocol is live and that an empty HTTP 200 envelope can
be transient or content-specific; it must not be treated as definitive content status without an
explicit upstream message.

## Implementation

- Reclassify an empty format list as retryable `provider_unavailable` and an unreadable or missing
  descriptor token as retryable `provider_schema_changed`.
- Retry `/extract` once inside the same 90-second Worker execution after a one-second delay. Do not
  replay the BullMQ task and do not repeat bootstrap, token, conversion, or media delivery.
- Record only the extract-attempt count and existing sanitized phase/status/count fields. Source
  URLs, response bodies, tokens, signatures, titles, and media URLs remain excluded.
- Preserve terminal handling for explicit private, invalid, removed, and unsupported responses.
- Preserve the existing sequential route order `9xbuddy -> locoloader`, exact Delivery policies,
  one-in-flight limit, and all public contracts.

No ADR is required because Provider selection, persistence, and media delivery boundaries do not
change; this corrects error classification and adds a bounded retry inside the existing adapter.

## Verification and release

Provider tests cover the empty-format fixture, bounded recovery, terminal content responses,
sequential fallback, and queue replay prohibition. Run targeted tests, `pnpm check`, and
`git diff --check`.

After CI and exact-SHA image verification, deploy with a backup while preserving all current
Provider states. Then enable only the already reviewed LocoLoader xHamster gate triplet and unique
rollout rule as the low-quota secondary route. Validate one known public xHamster sample and one
user-supplied failing sample. If both 9xBuddy extract attempts remain empty, the attempt ledger must
show LocoLoader next; no other platform gains LocoLoader access.
