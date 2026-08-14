# ADR-0014: Provider capability evidence and deterministic traffic distribution

- Status: Accepted
- Date: 2026-08-14
- Scope: work item 13
- Extends: ADR-0004, ADR-0006, ADR-0012

## Context

A Provider declaring a platform does not prove that current URLs still resolve or that its media
candidates are safe to deliver. TikDD also needs to distribute first attempts across multiple
eligible Providers without confusing this distribution with rollout admission or issuing parallel
requests.

## Decision

### 1. Make capability evidence explicit

Every Manifest platform capability declares one status: `unverified`, `fixture_verified`,
`canary_failed`, `canary_verified`, or `delivery_verified`. A non-empty delivery mode is valid only
for `delivery_verified`. A failed canary records negative evidence but does not remove the platform
declaration or claim that all URLs on that platform are unsupported.

Capability support, base priority, evidence status, and delivery modes remain code-owned. Admin may
observe them and narrow routing, but cannot create or promote a capability.

### 2. Pin qualification canaries to one Provider

Each scheduled canary runs through a single-Provider Router with one maximum attempt. It cannot use
another Provider's fallback result. The persisted measurement remains sanitized and attributable to
the Provider named by the authorized tuple.

### 3. Separate rollout admission from first-choice share

A published `(platform, region)` policy may contain `stagedAllocations`, `trafficShares`,
`orderedProviderIds`, and narrowing `concurrencyCaps`. Non-empty traffic shares are unique, positive,
reference production-eligible Providers in the manual order, and total exactly 10,000 basis points.

After eligibility filters run, the Router hashes the server-generated task ID with platform and
region into a stable bucket. The selected eligible Provider moves to the front; every remaining
Provider preserves the published bounded fallback order. No request fan-out is introduced. If no
share policy exists, routing preserves manual-order behavior.

## Invariants

1. Traffic shares choose one first attempt and never create parallel upstream requests.
2. Rollout denial, region, circuit state, concurrency, terminal errors, deadlines, and maximum
   attempts remain authoritative.
3. Capability evidence cannot widen delivery permissions.
4. Public OpenAPI and public results contain neither traffic policy nor candidate details.
5. Platform recognition remains an explicit Host catalog with spoofed-host tests.

## Consequences

Admin route-policy revisions gain a backward-compatible `traffic_shares` JSON field, and the Redis
route-policy snapshot advances to schema/key version 2. Existing policies default to no traffic
shares. The capability matrix can distinguish unavailable evidence from verified delivery without
turning a catalog entry into a public support promise.
