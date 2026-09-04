# Work Item 18 — Qualification Admin productization

Status: implemented and verified locally on 2026-09-04; production rollout is pending owner deployment review.

## Outcome

The Owner Console now presents one exact Provider/platform/region qualification workflow backed by
the existing qualification, evidence, proposal, policy, guard, Canary, and rollout records. It does
not introduce another qualification engine and does not grant traffic.

## Authoritative workflow

- `GET /admin/v1/qualification/:providerId/:platform/:region` returns a sanitized exact-tuple view.
- The view separates Manifest declaration, runtime enablement, region support, fixture verification,
  controlled delivery, fresh Canary proof, three-day calibration, and policy lock prerequisites.
- Calibration is complete only when the latest three internal UTC days are consecutive and sealed,
  meet the proposal minimum sample count, and match the proposal's exact aggregate revisions.
- The latest proposed policy exposes its bounded values and evidence provenance. The current locked
  policy, restrictive guard, deny-first rollout result, and effective allocation cap remain separate.
- `POST /admin/v1/qualification/lock-policy` atomically verifies the current proposal and sealed
  evidence revisions, locks the existing policy model, records an evidence review, updates the
  qualification revision, and returns an authoritative receipt.
- `POST /admin/v1/qualification/review` records explicit `approve`, `hold`, or `deny` decisions.
  Approval advances exactly one lifecycle stage. Hold and deny preserve the current stage and pause
  the tuple.

## Safety boundaries

- All reads require the existing Owner authentication and same-origin boundary.
- All writes additionally require subject-bound CSRF, exact tuple confirmation, a bounded reason,
  an idempotency key, and the expected qualification revision.
- Policy lock additionally requires the exact proposal ID and proposal revision.
- Qualification approval never creates, edits, or increases a rollout rule. Public traffic remains
  controlled independently by route policy, rollout authorization, circuits, and restrictive guard.
- Admin responses continue through the privacy boundary and contain no source URL, delivery URL,
  credential, upstream header, task capability, or raw Provider payload.
- Migration `0022_qualification_admin.sql` only extends the existing authoritative command-receipt
  aggregate constraint; it adds no traffic-grant state.

## Verification

- `pnpm test:work-item-18` covers contracts, exact confirmation, service gates, policy-lock
  provenance, restrictive decisions, authentication, CSRF, fixed client paths, and migration shape.
- `pnpm verify:work-item-18` additionally proves review replay, atomic policy lock, exact evidence
  revisions, cleanup, and zero created rollout grants against PostgreSQL.
- `pnpm check` is the final repository gate before handoff.

## Explicitly out of scope

This implementation does not start calibration, submit real Provider tasks, create a public pilot,
increase allocation, run a Delivery/browser journey, or change X lifecycle/SEO status. Those remain
separately authorized operational actions under the X Production Evidence Gate.
