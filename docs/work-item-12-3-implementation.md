# Work item 12.3 implementation — owner overview, observatory, and alerts

## Outcome

The approved Admin prototype now renders real sanitized reads from `apps/admin-api`. Demonstration
Providers, invented time series, fake queue values, and browser-only traffic controls were removed.
The result is a read-only operating console for one site owner with server-rendered initial state,
bounded same-origin refresh, exact route inspection, derived alerts, catalog coverage, publishing
readiness, and dependency freshness.

## Data path

The browser requests only the Admin origin. Next.js composes one fixed snapshot from a strict list
of Admin API endpoints and validates every resource independently. The server connection is
loopback-only, preserves the reviewed external Host, sends the exact Admin Origin, and forwards only
the Access assertion plus server-side origin proof. Cookies and arbitrary browser headers are not
forwarded. Responses are capped at 2 MiB and time-bounded.

A failed source remains `unavailable` while successful sources continue to render. Missing values
use an em dash or explicit explanation; they are never converted into zero or healthy state.

## Product surface

- Owner brief with anonymous queue, delivery, route, and publication aggregates.
- Attention queue derived from exact route state, queue pressure, delivery degradation, active
  restrictions, publishing gaps, and dependency freshness.
- Routing Observatory with platform/state filters, a real sequential route runway, a route table,
  and exact Provider/platform/region inspector.
- Read-only Provider and platform catalog projections.
- Published snapshot and SEO readiness summary.
- PostgreSQL, Redis, queue, scheduler, and content-snapshot freshness.

All future mutation destinations remain visible in the information architecture but no write
control is active. Route actions clearly state what can be inspected now and what remains gated by
work item 12.4.

## Verification

- `pnpm test:work-item-12-3` covers the server boundary, partial reads, attention model, security
  headers, Admin API composition, and privacy contracts.
- The Admin production build confirms the page and same-origin snapshot route are dynamic SSR.
- Real-browser desktop/mobile QA and its resolved findings are recorded in
  `docs/design/work-item-12-3-design-qa.md`.
- Focused verification passed 6 files and 23 tests. Repository `pnpm check` passed 53 files and
  227 tests plus every workspace typecheck and production build.

## Next step

Work item 12.4 may add route-policy drafts and bounded controls only through the mutation invariants
accepted in ADR-0010. It must not reuse this read snapshot as a generic proxy or expose optimistic
success.
