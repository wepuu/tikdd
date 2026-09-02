# ADR-0015: Post-Provider completion retry boundary

- Status: Accepted
- Date: 2026-09-02
- Scope: P0-X-RETRY-MASKING-01
- Extends: ADR-0002, ADR-0005, ADR-0007

## Context

BullMQ retries a resolve job up to three times so transient Provider failures can recover. The
Worker previously ran Provider resolution, candidate encryption and transactional task completion
inside one retryable callback boundary. A Provider could therefore return a valid resolution and
then be contacted again when a local completion write failed. Exhaustion also caused the final
listener to overwrite the original local failure with `PROVIDER_UNAVAILABLE`.

Provider success and task success are different facts. A successful external resolution followed
by a local completion failure must preserve the successful Provider attempt without implying that
the Provider failed or automatically repeating the external request.

## Decision

The Worker keeps the existing three-attempt BullMQ budget and the ProviderRouter's bounded,
sequential fallback behavior. It introduces an explicit boundary immediately after
`ProviderRouter.resolve()` returns a validated resolution:

- before Provider success, retryable `ProviderRoutingError` remains an ordinary job failure and
  BullMQ may retry;
- a non-retryable Provider failure records its attempts, fails the task with the Provider-derived
  error and throws `UnrecoverableError`;
- after Provider success, candidate preparation or completion persistence failure records the
  returned attempts and fails the task with `TASK_COMPLETION_FAILED`, then throws
  `UnrecoverableError` so BullMQ cannot replay the Provider;
- Redis admission release remains best effort after every terminal outcome and can never reopen
  the Provider retry boundary.

`TaskRepository.failAfterProviderResolution()` performs the attempt-ledger insert, task failure and
active-source release in one transaction. It locks and preserves a task that is already terminal,
which also handles the ambiguous case where a completion commit succeeded but the client observed
an error. No raw candidate or Provider response is checkpointed in Redis, BullMQ or task errors.

The BullMQ exhausted-job listener reads current task state and changes only a still-active task.
Failed, succeeded, expired, missing or concurrently terminalized tasks are not overwritten. A
compare-at-write repository operation closes the race after the read. Generic retryable
`PROVIDER_UNAVAILABLE` remains correct only when normal Provider attempts are exhausted before any
Provider succeeds.

Public completion errors contain only:

```json
{
  "code": "TASK_COMPLETION_FAILED",
  "message": "The resolved task could not be completed.",
  "retryable": false
}
```

Internal logs identify the task, completion stage, error class, a bounded redacted message and a
safe five-character database code when present. They never contain candidate URLs, signed query
parameters, encrypted payloads, keys, cookies or upstream bodies.

## Invariants

1. A validated Provider success is the final external-resolution call for that BullMQ attempt.
2. Post-Provider local failures are never ordinary retryable BullMQ failures.
3. A failed task may truthfully coexist with a succeeded Provider attempt.
4. Generic Provider exhaustion never overwrites a persisted terminal task.
5. Provider retry count, Router fallback, queue topology, public result and Delivery boundaries do
   not change.

## Rejected alternatives

- Reducing all jobs to one attempt would remove intended transient Provider recovery.
- Splitting resolution and completion into separate queues is unnecessary for the confirmed defect
  and would introduce a larger persistence protocol.
- Saving raw or signed candidates in BullMQ/Redis would expand the delivery-secret boundary.
- Detecting stages from error-message text would be fragile and could expose sensitive details.

## Consequences

The Worker processor and exhausted-job listener are small testable modules while `worker.ts`
remains the composition root. The repository gains two narrow state-aware writes but no schema or
public API changes. A Worker image replacement is required to activate the behavior.
