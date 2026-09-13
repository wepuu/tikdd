# ADR-0032: Technical evidence is the Provider availability signal

Status: accepted for Work Item 53 (2026-09-13)

## Decision

Free Provider candidates are evaluated from observable transport and protocol behavior, not from
marketing copy or claims rendered on a landing page. A candidate can be marked `reachable` after a
bounded HTTP check, but it is not implementable until a real request produces a normalized result
with at least one valid MP4 resource. Delivery qualification additionally requires a reviewed
Provider/media host policy and a direct browser download check.

The intake record keeps two independent signals: `technicalState` (`not-tested`, `reachable`,
`resolved`, `no-media`, or `blocked`) and the existing `evidenceState` used by fixture/canary
qualification. Reachable, no-media, and blocked defer a candidate; they do not permanently reject it.
The existing public-only, authentication, challenge, and paid-access boundaries remain independent
policy checks. A page statement cannot set `publicContentOnly=false`.

## Operational boundary

Technical preflight is a manually invoked, bounded diagnostic. It does not submit user URLs, run in
CI, create rollout rules, or enable traffic. Logs contain only provider id, status/category,
redirect count, and sanitized failure code. Provider-specific adapters still own protocol parsing,
normalization, and exact host policy checks.

TikCD is the first candidate with a positive protocol observation in this work item: the reviewed
NL probe received `code=0` JSON from `tikwm.com/api`, and a returned TikTok CDN range response was
`206 video/mp4` for the supplied public sample. It remains resolution-only until fixture coverage,
host review, and browser Delivery evidence are complete.

## Consequences

This prevents false negatives caused by provider marketing text and false positives based only on a
reachable homepage. Production routing remains fail-closed while technical evidence is collected in
small, bounded batches.
