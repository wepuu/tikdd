# X-GATE-03 — Bounded calibration operations

Status: implemented and locally verified; not deployed or executed.

## Inputs

Copy `config/x-calibration-authorization.example.json` outside the repository and replace every
placeholder. `status` must become `authorized` only after the owner approves the exact values. The
source file used by `submit` contains the one approved URL; the authorization contains only its
lowercase SHA-256 digest. Do not put the URL in shell arguments, environment files, snapshots, or
logs.

The preflight snapshot is a short-lived sanitized capture from authoritative production reads. It
has these exact top-level fields: `schemaVersion`, `capturedAt`, `releaseSha`, `deploymentId`,
`publicRuntime`, `operationalServices`, `canary`, `circuit`, `qualification`, `rollout`, `queues`,
`calibrationServices`, and `emergencyDeny`. It must be captured no more than 60 seconds before
preflight. Never hand-edit a failed snapshot into a passing one; recapture it after the underlying
condition is corrected.

## Commands

All examples are documentation only and must not be run without a separate production
authorization. `preflight` and `status` do not start services. `start`, `submit`, and `stop` require
the exact authorization ID in the current shell:

```text
pnpm calibration:preflight -- --authorization /secure/auth.json --snapshot /secure/snapshot.json --state-dir /run/tikdd/calibration-operations --release-env deploy/production.env
TIKDD_CALIBRATION_EXECUTE=<authorization-id> pnpm calibration:start -- --authorization /secure/auth.json --snapshot /secure/snapshot.json --state-dir /run/tikdd/calibration-operations --release-env deploy/production.env
TIKDD_CALIBRATION_EXECUTE=<authorization-id> pnpm calibration:submit -- --authorization /secure/auth.json --url-file /secure/source-url --state-dir /run/tikdd/calibration-operations --release-env deploy/production.env
pnpm calibration:status -- --authorization /secure/auth.json --state-dir /run/tikdd/calibration-operations --release-env deploy/production.env
TIKDD_CALIBRATION_EXECUTE=<authorization-id> pnpm calibration:stop -- --authorization /secure/auth.json --actor <authorized-owner> --state-dir /run/tikdd/calibration-operations --release-env deploy/production.env
```

`submit` sends the URL through stdin to a process inside `calibration-api`; it reports and stores
only the task ID. The authorization-scoped state enforces cadence and total task count. The Worker
remains concurrency one. At the window end, API and Worker stop themselves even if the operator's
stop command is missed.

`stop` remains available when the state file is missing or the window has expired, provided the
external authorization and stop actor are valid. It stops only `calibration-worker` and
`calibration-api`, removes only `calibration-api.attestation` and
`calibration-worker.attestation`, and records a sanitized stop receipt when possible.

## Explicit exclusions

This work does not deploy or start the profile, contact SSSTwitter, create a calibration task,
start Admin, lock a policy, create or increase rollout allocation, start a public pilot, promote X,
publish content, or change indexing.

Verify locally with `pnpm verify:x-gate-03` and `pnpm check`. Compose verification may use only
`docker compose ... config`; do not use `up`, `run`, `start`, or `exec` during repository review.
