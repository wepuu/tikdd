# Bounded expiry cleanup operations

Work item 9.4 implements the physical-retention boundary accepted in
[ADR-0007](architecture/adr/0007-rollout-admission-and-abuse-controls.md). Logical expiry remains
the authorization boundary: delayed cleanup never makes expired data usable again.

## Service boundary and order

`@tikdd/cleanup` is separately deployable from Web, API, resolver workers, and delivery. It first
acquires `tikdd:cleanup:v1:<deployment>:lease`; a second instance skips that interval.

Each stage uses a separate small transaction, stable ordering, a row limit, and
`FOR UPDATE SKIP LOCKED`: expired tickets and their anonymous expiry outcomes, delivery outcomes,
encrypted candidates, canary measurements, daily evidence, calibration/review records, and Pilot
audits; expired idempotency and active-source records; task status expiry; then hard deletion after
`expires_at + TASK_HARD_RETENTION_MS`.
Task deletion cascades to attempts and residual task-owned rows. Cleanup never reads or decrypts
candidate payloads and never emits task IDs, digests, canonical URLs, or source metadata.

## Configuration

```dotenv
CLEANUP_DEPLOYMENT=local
CLEANUP_INTERVAL_MS=60000
CLEANUP_BATCH_SIZE=100
CLEANUP_TIME_BUDGET_MS=5000
CLEANUP_MAX_BATCHES=24
CLEANUP_STATEMENT_TIMEOUT_MS=2000
CLEANUP_LEASE_TTL_MS=15000
TASK_HARD_RETENTION_MS=86400000
```

Production requires an explicit deployment namespace. The lease TTL must exceed the run budget by
at least five seconds. A zero hard-retention value is for controlled verification only.

## Commands and telemetry

```sh
pnpm cleanup:dry-run
pnpm cleanup:run
pnpm cleanup:start
pnpm verify:cleanup
```

Dry-run acquires the singleton lease and reports eligible counts without mutation. Runs emit only a
JSON metrics envelope: mode, lease outcome, timestamps, duration, batch count, per-stage affected
rows, error count, failed stage, and stop reason. `time-budget` or `batch-budget` means remaining
rows will be picked up safely next interval.

Alert on repeated `error`, lease unavailability beyond two normal intervals, or a backlog that does
not decline. Redis cleanup is limited to releasing its owned lease. Other TikDD Redis keys expire
through their own TTLs and are never scanned or bulk-deleted here.

## Verification and rollback

```sh
pnpm db:migrate
pnpm verify:cleanup
pnpm check
```

The Docker probe verifies no-write dry-run counts, singleton contention, bounded task cascade,
fresh-row preservation, complete cleanup, lease release, and a zero-change repeated run.

To pause physical deletion, stop only cleanup; logical expiry remains enforced. Retention can be
lengthened before restart. Migration `0010` adds evidence cleanup stages and indexes; it does not
permit cleanup to delete a source bucket before its 48-hour sealing boundary.
