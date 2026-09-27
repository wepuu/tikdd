# Work Item 112 — YouTube format routing and split-stream integrity

## Baseline and scope

The baseline is the current `main` line before this change. This work item addresses the failure
seen after both YouTube providers returned `invalid_result`: NoAdsDL's live API had moved to a
sparse `video_formats` schema and SnapYT's result page included `fmt=0` plus separate audio/video
resources. The work item changes only provider parsing and bounded media validation. It does not
change the public API, database, Delivery transport, or production gates.

## Implementation

- NoAdsDL recognizes the legacy codec-rich and current sparse combined-MP4 schemas. Optional
  metadata may be absent; a safe `format_id` and a bounded MP4 resolution key are required.
- NoAdsDL preserves the original status URL when a processing response omits `status_url`, so a
  queued job can reach its ready response within the existing poll budget.
- SnapYT accepts the observed numeric force-download format identifiers, including `fmt=0`, while
  retaining the exact host/path/action/query allowlist. It sequentially probes at most five
  candidates and verifies status, attachment disposition, non-empty bytes and a recognized audio
  or video MIME type.
- SnapYT labels verified resources as combined, video-only or audio-only. Separate resources are
  not merged or proxied; each remains an explicitly labeled Delivery candidate.
- Diagnostics add schema/composition and rejection counters without recording source URLs,
  response bodies, cookies, tokens, query values or media URLs.

## Test evidence

Fixtures cover NoAdsDL sparse metadata, processing responses without `status_url`, SnapYT `fmt=0`,
combined MP4, audio-only, video-only, non-media and bounded candidate probing. The focused provider
suite passes 29 tests. Production remains unchanged and both YouTube rollout paths must stay gated
until separate browser verification is authorized.

## Release boundary

After CI and an exact-SHA image are available, validate NoAdsDL first with one public sample, then
SnapYT in isolation with one public sample, and finally the sequential NoAdsDL → SnapYT route. A
failed sample closes the relevant rollout before its three gates. No client-side merge, server
media proxy, Provider-page handoff or automatic gate change is part of this work item.
