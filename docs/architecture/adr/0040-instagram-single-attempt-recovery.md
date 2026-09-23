# ADR-0040: Single-attempt Instagram recovery and evidence-gated fallback

## Status

Accepted for Work Item 91. Production activation remains disabled until the repaired image passes
the bounded release verification.

## Context

The SaveFromIns Instagram route produced no successful Provider attempt in the seven days ending
2026-09-23. Six attempts failed: four `invalid_result`, one `provider_timeout`, and one
`provider_schema_changed`. Two additional public tasks were denied while the exact circuit was
open. Delivery had no corresponding recent outcome because the failures happened before ticket
creation.

The exact rollout and all process gates were enabled, and every core container was healthy. A
single disabled-route protocol observation then returned HTTP 200 JSON using the already supported
`data.resources` envelope, with one reviewed direct MP4 candidate. This proves that the Provider
did not globally replace its successful schema; different content or upstream states still produce
inconsistent outcomes, and the former diagnostic was too coarse to distinguish them.

The Provider is known to apply request-frequency controls. Replaying a timeout from the same NL
egress can increase access friction without producing independent evidence.

## Decision

- An Instagram queue job has one execution. SaveFromIns is never replayed by BullMQ. Future
  Provider fallback remains sequential inside that one router execution.
- Explicit unsuccessful SaveFromIns envelopes are classified as Provider failures. Only malformed
  or unrecognized envelopes are `provider_schema_changed`.
- A valid observed success may omit `status_code` when another reviewed success marker and a valid
  `data.resources` or `data.media[].resources` collection is present. Optional resource quality may
  be absent or null and normalizes to `Original`.
- Diagnostics expose only bounded envelope/resource enums and aggregate rejection counts. They do
  not expose submitted URLs, response bodies, titles, authentication values, headers, cookies, or
  media addresses.
- Delivery policy `savefromins-instagram-media-v2` is unchanged. Parser recovery cannot discover or
  authorize a new media host at runtime.
- SocialDownloader is not promoted to an Instagram fallback in this item. One current sample
  resolved to its reviewed stream and one timed out, so it did not meet the two-sample repeatability
  gate. No Instagram Delivery policy, runtime platform approval, or rollout rule is created for it.

## Operational boundary

The unique `savefromins / instagram / nl` rule is disabled while the code is repaired. After an
exact-SHA deployment, two distinct owner-authorized public samples must each create exactly one
SaveFromIns attempt, one ticket, a reviewed redirect, and a non-zero browser download. The circuit
must recover without a manual broad reset. Any failure disables only the Instagram rule again.

X, TikTok, Facebook, Vimeo, Pinterest, Admin, and calibration state are not changed. Provider pages,
server-side media proxying, challenge bypass, user cookies, and broader host suffixes remain
forbidden.
