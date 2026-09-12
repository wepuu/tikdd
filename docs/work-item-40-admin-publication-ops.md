# Work Item 40 — Admin publication operations hardening

Status: implemented locally on `codex/stage6-admin-publication-ops`; awaiting the normal PR/CI and
owner-authorized production deployment steps.

## Objective

Close the first-publication loop without adding a second content authority, persistence model,
delivery path, or permanent Admin process. Admin must make the immutable snapshot lifecycle easy to
understand and the production start/stop path must fail closed when the requested write scope is not
actually running.

## Included changes

- The Admin console derives publication counts and alerts from the authoritative content,
  publication, and SEO read models whenever those controls are available. The legacy overview
  aggregate remains a compatibility fallback for older API responses.
- The proofing desk presents the lifecycle as structured validation, complete snapshot, path
  confirmation, and public read. It labels idle/propagating/propagated/failed states, explains every
  disabled publish action, requires the deployment confirmation value, and avoids suggesting that an
  idle path step is interactive.
- The publication center reports an acknowledged revision with zero diff as `已发布` and removes the
  stale first-publication warning after Web propagation.
- `scripts/production-release.sh admin-start` optionally accepts
  `TIKDD_ADMIN_EXPECTED_WRITE_MODE=readonly|content-draft|full`, verifies the actual Admin API
  container environment, and stops the Admin pair on mismatch. A release-env-bound `admin-account`
  one-shot operation removes the need for ad-hoc Compose Admin commands. `admin-stop` retains the
  404 stage gate.
- Documentation closes Work Item 39 with the actual `r1` publication evidence and records this
  bounded Stage 6 batch.

## Verification

- Unit coverage asserts authoritative publication data wins over stale overview values and that a
  propagated `r1` with no diff produces no publication alert.
- `sh -n scripts/production-release.sh` and Compose configuration validation cover the release
  script boundary; the existing `pnpm check` remains the required repository gate.
- No SaveFromIns or other Provider request, calibration run, rollout change, Admin permanent start,
  database migration, SEO/indexability change, or Delivery behavior change is part of this item.

## Production handoff

After PR CI and merge, verify the three GitHub-built image digests, take the standard PostgreSQL and
configuration backups, and deploy the exact merge SHA only after a separate owner authorization.
Admin remains stopped outside an explicitly approved session. If a later content session is needed,
pass the expected write mode to `admin-start`; on mismatch the script stops Admin before the stage
gate can expose it.
