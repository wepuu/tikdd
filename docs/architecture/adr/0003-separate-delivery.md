# ADR-0003: Separate media delivery

- Status: Accepted
- Date: 2026-08-03

## Context

Resolved media may be directly downloadable, may require constrained upstream headers, or may require
audio/video merging. Passing all bytes through the control API would couple API reliability to file
size, bandwidth, and slow clients.

## Decision

Create a distinct delivery service. It accepts only a task identifier and normalized format
identifier. It looks up a server-side delivery candidate and chooses one of:

1. Short-lived redirect for validated direct URLs.
2. Controlled byte-range proxy when required headers cannot be delegated.
3. Temporary object storage for merged, transcoded, or restartable output.

The service never accepts a public arbitrary upstream URL.

## Consequences

- Control API instances stay stateless with respect to large byte streams.
- Delivery can scale and account for egress separately.
- The service requires explicit SSRF, DNS rebinding, range, quota, and file lifecycle controls before
  real providers are enabled.
