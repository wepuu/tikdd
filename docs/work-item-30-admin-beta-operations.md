# Work Item 30 — Private Admin Beta operations view

Status: implemented locally on the unpushed WI29 branch. This work item adds a small, read-only
owner-console surface for the currently supported X and Instagram Beta routes.

## Scope

- `GET /admin/v1/beta-health` is available only behind the existing Admin Host, origin-proof and
  owner-session boundary. The window is bounded to 1–168 hours; the console offers 24 hours and
  seven days.
- The response contains only sanitized task, Provider-attempt and Delivery aggregate counts,
  normalized failure categories, rates and timestamps. It never includes URLs, task IDs, Provider
  identity, upstream payloads, headers, cookies, CDN addresses or credentials.
- The Admin BFF forwards this fixed read through the existing loopback connection. The dashboard
  explicitly reports that SaveFromIns remains an experimental, best-effort Instagram Beta route.

## Non-goals and safety

This is not a traffic-control, rollout, gate, Provider-selection, calibration or alerting command.
It adds no database migration and does not change the public Web, Delivery redirect, queue or
Provider request path. Admin remains on-demand and stopped in production until separately approved.
Unavailable reads fail closed and do not invent healthy values.

## Verification

Run the Admin API route/auth tests, Admin client tests, Admin contracts typecheck, `pnpm lint` and
`pnpm typecheck`. The existing full check may still require local Web content data during its
static-build phase; record that infrastructure limitation separately from code/test results.
