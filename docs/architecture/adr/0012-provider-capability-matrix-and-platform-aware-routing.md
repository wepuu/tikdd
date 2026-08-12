# ADR-0012: Provider capability matrix and platform-aware production routing

- Status: Accepted
- Date: 2026-08-13

## Context

A Provider may resolve more than one platform, and its delivery qualification may differ by
platform. A platform declaration that only says “supported” cannot distinguish metadata parsing
from an audited production download path. It also lets an Admin preference accidentally route
production work to an adapter whose result cannot be delivered safely.

## Decision

Each code-owned Provider Manifest declares one capability per platform catalog slug. A capability
contains the platform, its base priority, and an explicit list of reviewed delivery modes. Presence
means the Provider may parse that platform. An empty delivery-mode list means resolution-only and
is not production eligible.

The Worker re-recognizes every queued URL, requires the detected platform to equal the queued
platform, and routes with the new canonical URL. The Router filters by enabled Manifest capability,
region, production delivery eligibility, rollout and safety controls, circuit state, and distributed
concurrency before ordering candidates. A published `(platform, region)` preference remains the
dominant order; unlisted routes are appended by platform priority plus bounded health, latency, and
cost signals. Calls remain sequential and bounded.

Every normalized Provider result must claim the recognized platform and the invoked Provider. Its
candidates must use modes declared by that platform capability. Production results must contain a
candidate for every public format. Violations become `invalid_result` and may fall back; terminal
content and policy errors still stop immediately.

The Owner Console reads capabilities from Manifests and may only narrow production order,
allocation, and concurrency. It cannot add a platform, Host rule, or delivery mode. Resolution-only
routes are displayed separately and may run a bounded technical Probe; pause and deny controls may
target any declared route. Redis stores only the route preference and narrowing limits, never a
copy of Manifest capabilities.

## Initial capability classification

- TwitterSaver / X: parsing plus `redirect`.
- SSSTwitter / X: parsing plus `redirect`.
- DLPanda: its existing multi-platform declarations remain, all resolution-only until a separate
  delivery audit approves an explicit mode.
- Development and failure-injection Providers: resolution-only and forbidden in production.

## Consequences

Adding a Provider or platform capability requires code review, runtime validation, fixtures, error
decisions, candidate-mode tests, and explicit Host rules. Admin policy publication is revalidated
against the currently deployed Manifest, so an old revision cannot expand a capability after code
changes. No database migration or public resolve-result/OpenAPI change is required.
