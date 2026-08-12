# Work item 12.3 design QA — real owner-console reads

## Result

Passed for the read-only foundation scope. No open P0 or P1 finding remains.

The implementation keeps the approved light “signal runway” direction rather than replacing it
with a generic dashboard. The route runway remains the signature operational object; the new owner
brief and attention rail answer the daily question “what needs attention?” without inventing
metrics or exposing raw task/media data.

## Actual rendered review

Reviewed on 2026-08-11 against the real local Admin API, PostgreSQL, and Redis at:

- desktop: 1440 × 1024;
- mobile: 390 × 844;
- runtime state: local `tikdd / nl`, Providers disabled, scheduler and content snapshot stale;
- data: 12 manifest-derived routes, three Provider projections, platform catalog projections,
  seeded publishing readiness, queue/delivery aggregates, and dependency freshness.

## Findings resolved during implementation

- **P0 / integration:** standard Node `fetch` could not preserve the reviewed external Host while
  connecting to the loopback Admin API. Replaced it with a bounded loopback-only HTTP transport
  that sets the exact Host and forwards only the Access assertion and server origin proof.
- **P0 / route contract:** an empty durable rollout used internal revision `0`, while the Admin
  contract correctly requires a positive revision or `null`. The read service now normalizes an
  unpublished revision to `null`; the contract was not weakened.
- **P1 / attention quality:** every code-disabled capability initially appeared as a separate
  incident. Disabled capabilities are now one informational coverage item; active route failures
  retain exact Provider/platform/region alerts.
- **P1 / mobile navigation:** icon-only mobile links lost their accessible names when visible labels
  collapsed. Every link now has a stable explicit accessible label.
- **P2 / mobile layout:** the top navigation exposed a browser scrollbar. It remains horizontally
  usable but hides the decorative scrollbar; the route runway and table retain explicit contained
  horizontal scrolling.
- **P2 / development QA:** the production CSP correctly denied eval, but Next development tooling
  reported an error. `unsafe-eval` is allowed only in development; production policy remains
  unchanged.

## Verified behavior

- No document-level horizontal overflow at 390 px; the 720 px route runway is isolated inside its
  own 349 px scroller.
- Refresh completes and retains exact route selection without browser storage.
- Platform and state filters remain native keyboard-usable selects.
- Overview, route, alert, coverage, publishing, and dependency unavailable states are explicit.
- No new browser console error or warning after the final reload and interaction pass.
- Admin pages and the fixed snapshot route remain `no-store`, `noindex`, frame-denied, and covered
  by the restrictive CSP.

