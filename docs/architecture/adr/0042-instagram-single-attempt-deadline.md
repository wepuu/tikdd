# ADR-0042: Instagram single-attempt deadline alignment

## Status

Accepted for Work Item 93. This supersedes only the 25-second Provider and 30-second Instagram
route deadlines chosen in ADR-0041; its direct-first, single-attempt, diagnostic, and Delivery
decisions remain in force.

## Context

The Work Item 92 production image was deployed with the Instagram rollout disabled. During the
first bounded validation, SaveFromIns produced one `provider_timeout` attempt at 25 seconds, so the
rule and all three gates were closed without a second request. A later single no-retry diagnostic,
performed while public routing remained disabled, completed the same reviewed anonymous parse
protocol in about five seconds and returned a top-level direct MP4. This distinguishes intermittent
upstream latency from a response-schema or Delivery-policy defect.

TikDD intentionally does not replay SaveFromIns requests because the upstream applies frequency
controls. The former Web polling window was also only about 30 seconds. Raising only the Provider
timeout would therefore let the browser stop waiting while a valid single request was still active.

## Decision

- Keep exactly one SaveFromIns request per Instagram user task and no BullMQ replay.
- Increase the SaveFromIns manifest timeout from 25 to 40 seconds.
- Give Instagram routes a 45-second minimum total budget. The configured 30-second budget remains
  unchanged for X, Facebook, TikTok, Pinterest, Vimeo, and other platforms.
- Extend the public task polling window from about 30 to 60 seconds while preserving the 750 ms
  polling cadence.
- Keep the direct-first parser, asynchronous SSE exclusion, versioned Delivery host policy,
  circuit breaker, and emergency rollout controls unchanged.
- Do not treat the longer bounded wait as permission to retry, probe repeatedly, widen hosts, or
  bypass an upstream challenge.

## Release boundary

Deploy immutable GitHub images while the unique Instagram/NL rule and three SaveFromIns gates are
closed. Reopen them only for two sequential public browser downloads. Each task must produce one
Provider attempt, one reviewed ticket/redirect, and a non-zero media transfer. On the first failure,
disable the rule before closing the gates; do not send the second sample.
