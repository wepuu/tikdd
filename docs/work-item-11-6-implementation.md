# Work item 11.6 engineering closure

Engineering status: complete on 2026-08-11. Real calibration and staged observation: not started.

## Personal-site operating model

TikDD has one site owner. There is no multi-role approval workflow or consumer-facing audit
feature. The site owner supplies the deployment settings, confirms permitted Provider use, starts
each bounded rollout stage, and may stop it immediately. Append-only technical change and Guard
records remain because they are required for rollback, stale-state protection, and troubleshooting.

## Delivered boundary

- `pnpm verify:work-item-11-baseline` is the single offline CI gate for work items 11.1 through
  11.5. It combines evidence privacy/replay, restrictive evaluation, deployment preflight,
  internal-observation isolation, emergency deny, cleanup, residue, and repository quality checks.
- The gate explicitly disables every real Provider, clears proxy variables, sends no live Provider
  traffic, and cannot create Pilot authorization.
- The checked-in preflight and evidence files remain `pending`. CI proves that this state is valid
  and fail-closed; it never converts synthetic fixtures into operational evidence.
- Existing rollout checkpoints remain `internal`, `5%`, `25%`, `50%`, and `100%`. Advancement is a
  manual site-owner action and the restrictive evaluator may only hold, reduce, or deny.

## Runtime work that cannot be completed in source control

1. Choose the real deployment ID, Worker region, and direct/trusted-proxy mode.
2. Confirm Provider terms and permitted production use for that deployment.
3. Pass the real technical preflight and start an internal observation class with its short-lived
   attestation.
4. Collect three complete sealed internal UTC days before locking measured numeric policy values.
5. Advance through the bounded checkpoints only after the preceding observation window is healthy.
6. Collect seven consecutive sealed, healthy and sample-sufficient public days before changing
   `config/x-pilot-evidence.json` to `complete`.

These are elapsed operational facts, not missing implementation. They must not be replaced with
fixtures, backdated rows, canary volume, or documentation claims.

## Verification

CI and local release verification use:

```sh
pnpm verify:work-item-11-baseline
```

The final event reports `operationalObservationComplete: false` while the checked-in real-time
evidence remains pending.
