# Work Item 17 — Scheduled operational services

Status: implementation and production proof complete (2026-09-04). This work item does not start X
calibration, a staged pilot, or public X allocation.

## Decision and boundaries

ADR-0016, “Production operational scheduling and freshness supervision”, selects host systemd
timers for cadence and reboot persistence, Docker Compose one-shot jobs for execution isolation,
Redis leases for singleton/overlap control, and PostgreSQL for the authoritative sanitized current
read model. The existing Canary, evidence and cleanup runtimes remain the business authorities.
There are no permanent scheduler containers and no Provider access from the readiness verifier.

Manual one-shot commands remain available:

```text
pnpm canary:run
pnpm evidence:run
pnpm cleanup:run
pnpm cleanup:dry-run
```

Scheduled wrappers are:

```text
pnpm canary:scheduled
pnpm evidence:scheduled
pnpm cleanup:scheduled
```

The wrappers persist sanitized execution state in migration
`infra/migrations/0021_operational_service_status.sql`. The actual production operations role was
inspected with `SELECT current_user, session_user` before migration and is `tikdd_ops`; the
migration grants only `SELECT, INSERT, UPDATE` on the status table, conditionally and idempotently.

## Status and freshness contract

The primary key is `(service, deployment)` for exactly `canary`, `evidence` and `cleanup`. Rows
contain the run ID, controlled supervision state (`running`, `completed`, `degraded`, `failed`, or
`lease_unavailable`), lease state, start/finish timestamps, `next_expected_at`, `stale_after_at`,
bounded `consecutive_failures` (0–10), controlled error code and a small sanitized summary. No URL,
candidate, cookie, token, HTML, upstream response or secret is persisted.

Cadence and grace windows are explicit: cleanup 60s + 30s grace, evidence 300s + 120s grace, and
Canary 900s + 300s grace. A missing row, failed/lease-unavailable state, or timestamp past
`stale_after_at` is not ready. A late run inside the grace window is exposed as `degraded`; only a
fresh completed run with a released lease is ready. `pnpm verify:operational-services` returns one
sanitized JSON object per required service and exits non-zero unless all are ready.

Provider/domain health is separate from scheduler health. A Canary cycle that executes, persists a
measurement and reports a failed Provider sample remains supervision `completed`; the sample
counts remain visible in the sanitized summary and the authoritative Canary measurement table.

## Scheduled Canary authorization

`config/provider-canaries.json` carries explicit `scheduledCanaryIds` and the scheduled path fails
closed on empty, unknown, duplicate or non-reviewed IDs. Production contains exactly:

```text
ssstwitter-x-recurring-001
provider = ssstwitter
platform = x
region = canary-global
url = https://x.com/SpaceX/status/2093477720638341395?s=20
```

TwitterSaver and DLPanda definitions remain manual/bounded and are not recurring-authorized. The
scheduled service uses a separate `TIKDD_SCHEDULED_CANARY_AUTHORIZED` flag; the manual
`TIKDD_CANARY_AUTHORIZED` flag remains false. Existing rollout, Provider health/circuit and
admission controls remain required, with one exact isolated `ssstwitter`/`x`/`canary-global`
rollout rule. Public `ssstwitter`/`x`/`nl` allocation remains zero and all Worker Provider flags
remain disabled.

## Deployment and operations

Repository-owned units:

```text
tikdd-canary.service / tikdd-canary.timer       every 15 minutes
tikdd-evidence.service / tikdd-evidence.timer   every 5 minutes
tikdd-cleanup.service / tikdd-cleanup.timer     every 1 minute
```

All timers use `Persistent=true`; services are bounded `Type=oneshot` units with no
`Restart=always`. The install script is idempotent and performs daemon reload, enable/start and
enabled/active/next-trigger checks. The host wrapper takes a shared `flock` on
`/run/lock/tikdd-deploy.lock` before executing the reviewed release. Redis leases remain active for
manual invocations, duplicate schedulers and stale process overlap.

Scheduled Compose services are `canary-scheduled`, `evidence-scheduled`, `cleanup-scheduled` and
`operational-readiness`. They have no host ports and `restart: "no"`; only Canary joins
`provider-egress`. Each service receives only its existing operations database/Redis (and Canary’s
rollout cohort key) secrets.

## Verification record

Repository checks required before deployment:

```text
pnpm check
pnpm verify:work-item-16
pnpm verify:work-item-17
git diff --check
```

Production migration, immutable service-image digest, timer activation, two timer-driven runs for
each service, freshness output, Provider-attempt counts and shared-host Stage Gate results are
recorded below. No calibration window is started by Work Item 17.

### Production evidence (2026-09-04)

- Merged `main` deployed: `56c6596a853f0e80c2a6b709759d99debea72b9c` at
  `/opt/tikdd/releases/56c6596a853f0e80c2a6b709759d99debea72b9c`.
- Service image is immutable:
  `ghcr.io/wepuu/tikdd-service@sha256:07a2d4d3b8a1dfb3b95b66f17bfc2abe546bb22538469e6cdf37af6f541099db`.
- Migration `0021_operational_service_status.sql` applied idempotently. The inspected production
  role is `tikdd_ops` with only `SELECT`, `INSERT`, and `UPDATE` on the status table (no `DELETE`).
- The exact rollout rule is `ssstwitter-x-canary-global-w17`, revision `1`,
  `ssstwitter/x/canary-global`, enabled with allocation `10000` bps. The existing
  `ssstwitter/x/nl` rule is disabled at allocation `0` (revision `12`). Worker Provider flags,
  rollout, health, and manual Canary authorization remain false; only the separate scheduled
  authorization is true.
- `tikdd-canary.timer`, `tikdd-evidence.timer`, and `tikdd-cleanup.timer` are enabled and active;
  all units pass `systemd-analyze verify`, use `Persistent=true`, and Cleanup is `OnCalendar=*:0/1`.

Timer-driven runs persisted by deployment `tikdd` (UTC; each pair is distinct):

| service | run 1 | run 2 | result |
| --- | --- | --- | --- |
| canary | `319d7dc3-ff21-49d6-8392-8687b501f4e2` at 11:00:05 | `7786a777-8246-4f13-aaba-3d932db87beb` at 11:15:05 | completed/released, 1/1 succeeded each |
| evidence | `454faecd-6e82-4e86-ab0d-e2de8aee38d1` at 10:55:04 | `b5c5c237-a876-4388-a514-034d32125a5f` at 11:00:05 | completed/released, tupleCount 0 |
| cleanup | `3803b261-efe2-4082-80be-20cb01b9514f` at 10:52:03 | `7ad4c576-7d7a-4df0-add7-23a1f3dfae25` at 10:55:04 | completed/released, 0 errors |

The final readiness verifier returned `fresh` and `ready=true` for all three services with
`consecutive_failures=0` and `scheduler_and_operational_freshness=PASS`. Canary measurements total
five, all `ssstwitter/x/canary-global` successes. The only `provider_attempts` row is a historical
`ssstwitter/x/nl` attempt at 2026-09-03 11:25:07 UTC; no public task, Delivery candidate, or ticket
was created during this proof (`public_counts=56/1/0/0`, pre-existing task/attempt data).
The six resident containers were healthy with restart count `0`, and the shared-host Stage Gate
passed with four Cloudflare HA connections. No permanent scheduled containers remain after each
one-shot run. X remains experimental/non-stable; calibration, pilot, and the Production Evidence
Gate are intentionally not started.
