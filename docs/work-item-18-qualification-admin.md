# Work Item 18 — Qualification Admin productization

Status: implemented, verified, and deployed to the NL production host on 2026-09-05. Admin remains
stopped and all public Provider rollout remains disabled.

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

## Production deployment

The first deployment attempt at `47097fff97380aff7e05204cbc476c6f1a6b89c1` correctly stopped
before the release-pointer switch because the one-shot Provider preflight received the legacy empty
signal object. API, Delivery, and Worker were restored to the previous immutable Service image; all
six persistent containers remained healthy. Migration `0022_qualification_admin.sql` was retained
because it is an idempotent, backward-compatible constraint extension.

PR #41 separated application deployment success from Provider qualification without weakening the
fail-closed boundary. A rollout-disabled release now requires a complete operator-supplied signal
object and the explicit `blocked` preflight decision (exit 2); a rollout-enabled release requires
`ready` (exit 0). Any malformed signal, runtime failure, or decision/status mismatch still stops the
release. The same change makes rollback validation independent of archive executable bits.

The reviewed production release is `3a359ce02372cbb1a2db27cb5d228dbb9ed158d2` with the release
receipt at `/opt/tikdd/releases/3a359ce02372cbb1a2db27cb5d228dbb9ed158d2/release-manifest.json`.
Backup verification, migration, every shared-host stage gate, and all six container health checks
passed. The Provider preflight returned the required `blocked` decision with Provider Manifests,
runtime rollout, Provider egress, calibration/evidence freshness, and emergency-deny measurement
still blocked. Admin containers and listeners were absent. The only enabled rollout rule remained
the pre-existing Work Item 17 `ssstwitter/x/canary-global` scheduler authorization from 2026-09-04;
the only Provider attempt remained the earlier bounded `ssstwitter/x/nl` verification from
2026-09-03. This deployment created no Provider rule, attempt, calibration, pilot, or public traffic.

## Explicitly out of scope

This implementation does not start calibration, submit real Provider tasks, create a public pilot,
increase allocation, run a Delivery/browser journey, or change X lifecycle/SEO status. Those remain
separately authorized operational actions under the X Production Evidence Gate.
