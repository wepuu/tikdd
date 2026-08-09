# Resolve task idempotency and duplicate admission

Work item 9.2 implements the idempotency and active canonical-source boundary from
[ADR-0007](architecture/adr/0007-rollout-admission-and-abuse-controls.md). It prevents duplicate
tasks and queue jobs without sharing another anonymous caller's task capability.

## Production configuration

All API instances in one admission domain require the same secret and active-source lifetime:

```dotenv
TASK_ADMISSION_HMAC_KEY_BASE64URL=<secret with at least 32 random bytes>
ACTIVE_SOURCE_TTL_MS=300000
```

The HMAC key must be different from rollout, candidate-encryption, and delivery secrets. Production
startup fails when it is absent or malformed. Local development uses an explicit development-only
fallback so the mock smoke flow remains usable.

Do not rotate this key during a rolling deployment. Mixed keys would produce different admission
identities. Until versioned dual-key reads are implemented, rotate through a coordinated maintenance
window after the maximum task/idempotency lifetime and active-source lifetime have drained.

`ACTIVE_SOURCE_TTL_MS` is bounded from 30 seconds to 15 minutes and never exceeds task expiry. It
limits how long an abandoned queued/resolving task can suppress another submission. Successful,
failed, and expired tasks release the active source immediately.

## Public request behavior

Clients may send an opaque `Idempotency-Key` header containing 16–128 characters from the documented
ASCII set. Use at least 128 bits of randomness; UUIDv4 is accepted. Never derive the key from a URL,
account name, or other user data.

- Same key and same normalized request: returns `202` with the original task and does not enqueue a
  second BullMQ job.
- Same key and different request: returns `409 IDEMPOTENCY_CONFLICT`.
- Different/no key while the same canonical source is active: returns
  `429 DUPLICATE_IN_PROGRESS` with bounded `Retry-After` and no existing task metadata.
- PostgreSQL admission failure: returns `503 ADMISSION_UNAVAILABLE` and creates no fallback task.

The Web client retains one random key across a failed network attempt for the same input, then clears
it after a task is accepted or the input changes.

## Stored data

`resolve_task_idempotency` stores only a 32-byte keyed digest, a domain-separated 32-byte request
fingerprint, task reference, and expiry. `active_source_admissions` stores only a domain-separated
32-byte platform/canonical-source fingerprint, task reference, and expiry.

Raw idempotency keys are never persisted or logged. URL fingerprints are server-keyed HMACs rather
than enumerable plain hashes. Admission records cascade with task deletion. General physical expiry
cleanup remains work item 9.4; reads and admission transactions already enforce logical expiry.

## Concurrency model

The transaction acquires deterministic advisory locks for the key digest and source fingerprint,
ordered to prevent deadlocks. It then performs idempotency replay/conflict checks, active-source
suppression, task creation, and admission-record inserts in one transaction. Only the `created`
winner calls BullMQ, whose job ID remains the durable task ID.

Terminal task updates delete the active-source record in the same database statement or transaction.
An idempotency record remains until task expiry so a lost `202` response can still be recovered.

## Verification

With PostgreSQL and Redis running:

```sh
pnpm db:migrate
pnpm db:verify-task-admission
pnpm check
```

The Docker-backed verification proves concurrent first use has one created task and one replay,
conflicting reuse returns the typed conflict, another key receives only a duplicate outcome, both
failed and successful terminal states release the source, and cleanup leaves no verification rows.
