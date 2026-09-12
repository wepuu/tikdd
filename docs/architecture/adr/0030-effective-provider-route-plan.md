# ADR-0030: Effective Provider route plan as a shared, read-only projection

## Status

Accepted for Stage 9 implementation.

## Context

The Worker already applies several independent gates before attempting a Provider: the manifest,
platform capability, region, delivery mode, rollout allocation, circuit state, concurrency and the
bounded manual order. Admin could inspect those inputs, but an owner still had to reconstruct the
actual attempt order mentally. That makes a single-route Instagram Beta look like it has an
implicit fallback and makes a disabled route difficult to explain.

## Decision

Add a small pure route-policy projection with two responsibilities:

1. Keep the existing score calculation and deterministic ordering in one shared function used by
   the Worker and the Admin read-only projection.
2. Derive a bounded effective plan (`primary`, real `fallback`, eligible-but-not-selected, or
   excluded) with a short sanitized exclusion reason.

The projection is calculated from already validated manifests, route-policy data and aggregated
health. It never probes a Provider, changes rollout, changes task state, or returns an upstream URL.
Admin renders the projection in the Providers workspace; advanced route writes remain folded behind
the existing full-maintenance scope.

## Consequences

- The owner can see the actual attempt order and why a route is not eligible without reading raw
  logs.
- Sequential fallback and the existing maximum-attempt bound remain unchanged.
- No database migration, public API change, new Provider, or production traffic change is needed.
- Unknown or duplicate Admin order entries are reported as invalid input to the projection rather
  than silently advertised as fallback.
- Future Provider adapters must still provide a validated manifest, explicit host policy and the
  normalised delivery/fallback tests described in `docs/provider-development.md`.

## Rejected alternatives

- Replacing the Worker router with an Admin-owned policy: this would cross the runtime boundary and
  make the control plane authoritative for execution details.
- Adding a new persistent route-plan table: the plan is derived from existing snapshots and does
  not need another source of truth.
- Showing every configured Provider as a fallback: a route is only a fallback when it is in the
  bounded effective attempt order.
