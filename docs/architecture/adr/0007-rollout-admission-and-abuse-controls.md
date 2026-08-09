# ADR-0007: Runtime rollout, admission, and abuse-control boundary

- Status: Accepted
- Date: 2026-08-09
- Scope: work item 9 production admission controls
- Extends: ADR-0004, ADR-0005, and ADR-0006

## Context

TikDD can now route sequentially across provider capabilities, persist sanitized attempts, derive
provider/platform/region health, and enforce distributed circuit state. Those controls answer
whether an integration appears healthy; they do not authorize production traffic, provide an
operator stop mechanism, or limit abusive task creation.

The current control API creates a new task and BullMQ job for every accepted request. It has no
idempotency key, canonical-URL admission deduplication, per-client quota, or active-task limit.
Provider enablement is process configuration, so changing it requires a restart. The API also
trusts forwarded addresses without a reviewed proxy boundary, which makes client-IP quotas
spoofable outside a correctly configured trusted network.

Production admission must remain separate from circuit health. A healthy provider can still need
an immediate policy or commercial shutdown, while a missing health snapshot intentionally degrades
to bounded static routing under ADR-0006. Conversely, a feature flag must not weaken terminal
content decisions, route budgets, provider host policies, or the delivery boundary.

Submitted URLs, idempotency keys, and network addresses are untrusted and potentially identifying.
Canonical deduplication must not reveal an existing opaque task capability, result metadata, or
delivery access to another anonymous caller.

## Decision

### 1. Apply independent admission and routing gates in a fixed order

A request and provider route pass these gates in order:

1. public request validation, rights confirmation, platform host recognition, and request limits;
2. idempotency and active canonical-request admission;
3. static provider manifest capability, production safety, region, and runtime rollout policy;
4. exact provider/platform/region circuit permission;
5. static-priority-dominant ranking, sequential fallback, and route budgets;
6. normalized result, candidate, and delivery-policy validation.

A later gate cannot override a denial from an earlier gate. Runtime rollout cannot enable a
development mock in production, add a platform absent from a provider manifest, broaden a region,
increase a provider deadline, bypass an open circuit, or authorize a delivery host. Terminal
private, authenticated, paid, DRM, geographic-policy, and content outcomes remain terminal.

### 2. Store reviewed rollout policy durably and distribute replaceable snapshots

PostgreSQL is the source of truth for versioned rollout rules and their append-only audit history.
Each change records an opaque operator identity, timestamp, reason, previous revision, replacement
revision, and normalized before/after metadata. Submitted URLs, task data, credentials, and
provider payloads are forbidden from rollout rules and audit records.

Redis carries only a revisioned, expiring compiled snapshot and change notification. Workers also
poll the durable revision, so a lost notification cannot leave them indefinitely stale. Publication
uses compare-and-set semantics; an older compiler cannot overwrite a newer revision.

The rule dimensions are:

- provider ID, required for provider rules;
- platform slug or `"*"`;
- concrete worker region or `"*"`;
- enabled/disabled state;
- rollout allocation in basis points from `0` to `10_000`;
- stable rule ID, revision, activation time, optional expiry, and change reason.

Fleet and provider emergency stops are explicit deny rules. Every matching deny wins. If no deny
matches, the most specific enabled rule supplies the allocation: exact provider/platform/region,
then one-wildcard variants, then broader provider rules. Ambiguous rules at the same specificity
are invalid configuration. Production defaults to denied when no reviewed rule matches; local
development may use an explicit development policy.

Percentage allocation is deterministic per task. The worker calculates a bucket with a keyed HMAC
over the stable rule ID and opaque task ID, never the source URL, canonical URL, IP address, media
metadata, or provider response. The secret is deployment configuration and the calculated bucket is
not persisted in public task data or logs. Changing a rule's percentage preserves existing task
cohorts because the rule ID remains stable; creating a new rule intentionally creates a new cohort.

Authorized canaries use an authenticated internal subject and a separately auditable rule. They
still obey fleet/provider emergency stops, manifest boundaries, circuits, deadlines, and delivery
policy. A public header or query parameter can never declare a request to be a canary or internal.

### 3. Make emergency denial fail safe and bounded

An operator denial must propagate to workers within five seconds in the first pilot without a Web
or API deployment. Workers retain the last validated snapshot only for its bounded stale interval.
After that interval, a production provider without a current affirmative rule is ineligible.

If Redis is unavailable, workers poll PostgreSQL and may use a non-stale in-process snapshot. If
both control stores are unavailable, new production provider calls fail closed after the stale
interval. This differs deliberately from ADR-0006 health degradation: missing inferred health may
fall back to bounded static routing, but missing explicit production authorization cannot invent
permission. Existing in-flight provider calls are not forcibly interrupted in the first pilot;
the denial prevents the next attempt and every new route.

The write boundary for rollout policy is protected and separate from public OpenAPI, resolve, SEO,
and delivery routes. Work item 9.1 may initially provide a narrow authenticated internal command or
configuration reconciler; it must not expose a consumer administration UI.

### 4. Give idempotency explicit conflict and lifetime semantics

`POST /v1/resolve-tasks` accepts an optional high-entropy `Idempotency-Key`. The API validates a
bounded ASCII format and never logs or persists the raw value. It stores a server-keyed digest,
request fingerprint, task ID, creation time, and expiry in PostgreSQL.

The request fingerprint covers the normalized contract fields that affect behavior, including the
canonical platform URL and rights confirmation, using length-delimited canonical encoding. It does
not use JSON property order. The digest and request fingerprint use domain-separated keyed HMACs so
database disclosure does not permit cheap recovery of submitted URLs or client keys.

Within the idempotency lifetime:

- the same key and same request return the same task representation without enqueuing another job;
- the same key and a different request return `409 IDEMPOTENCY_CONFLICT`;
- concurrent first uses have one database winner and at most one queue job;
- the record remains until its task can no longer be replayed, and its expiry never exceeds task
  hard-retention expiry.

BullMQ job identity is derived from the durable task identity, not the raw URL or idempotency key.
Queue retention is not the source of truth for idempotency.

### 5. Suppress duplicate active URLs without sharing anonymous task capabilities

The API stores a server-keyed canonical-source fingerprint over platform and canonical URL. It may
use that fingerprint to prevent concurrent duplicate work inside a short admission window, but it
does not use it as a result cache or return an existing task ID to an unrelated submission.

An idempotent replay is the only anonymous flow allowed to receive the original task capability.
When another key or a request without a key targets a source already being processed, the API
returns a generic bounded `429 DUPLICATE_IN_PROGRESS` with `Retry-After`; it exposes no task ID,
status, title, author, thumbnail, formats, provider, or delivery information. A terminal or expired
task releases the active-source admission lock. A stale lock has a bounded TTL and can be rebuilt or
cleared from PostgreSQL state.

Cross-caller result sharing, completed-result caching, and public task aliases are rejected for the
anonymous pilot. They require an authenticated ownership model or a separate internal execution
record with capability-safe result and delivery fan-out.

### 6. Derive anonymous quotas only behind an explicit trusted-proxy boundary

Production does not use unrestricted `trustProxy: true`. Each deployment declares exact trusted
proxy CIDRs or a reviewed hop count. When no trusted proxy is configured, the socket peer is the
client address and forwarded headers are ignored. Invalid or ambiguous forwarding chains fail
request admission; callers cannot select an address through `X-Forwarded-For`.

The API normalizes the accepted network address and computes a purpose-specific keyed HMAC. Raw
addresses and forwarding headers are not persisted in PostgreSQL, Redis values, logs, traces,
analytics, or diagnostics. Quota keys expire with their windows and are not reused for product
analytics, advertising, or cross-service identity.

Redis enforces bounded request rate and active-task concurrency for the anonymous pilot. Limits are
versioned policy by deployment/region, with stricter global emergency ceilings. Rate and
concurrency admission is atomic. Rejected requests return `429` and a bounded `Retry-After` without
creating a task or job.

The public submission path fails closed with `503 ADMISSION_UNAVAILABLE` when required quota or
deduplication state cannot be checked. It does not silently disable abuse controls. Health reads in
the worker retain ADR-0006's separate fail-soft behavior.

### 7. Separate API, route, provider, and delivery concurrency

Concurrency is enforced at independent boundaries:

- API admission limits outstanding resolve tasks per anonymous quota key and globally;
- the queue bounds worker-wide active jobs;
- a distributed lease bounds calls per provider/platform/region;
- each route remains sequential with its existing attempt and deadline budget;
- delivery retains separate ticket and future byte-transfer limits.

A permit has an owner token and TTL, is released with compare-and-delete semantics, and cannot be
released by another worker. Provider concurrency exhaustion allows normal sequential fallback only
when the error taxonomy and remaining route budget permit it; it cannot create parallel fan-out or
queue retry amplification.

### 8. Make logical expiry immediate and physical cleanup bounded

Every task, idempotency record, active-source fingerprint, quota counter, concurrency lease,
delivery candidate, and ticket has an explicit expiry. Reads enforce logical expiry even when the
cleanup process is delayed.

A scheduled singleton cleanup job processes PostgreSQL in small transactions using stable ordering
and `FOR UPDATE SKIP LOCKED` where competing workers are possible. It first removes expired tickets
and detached control records, then hard-deletes tasks after their configured retention boundary;
task cascades remove attempts and candidates. Cleanup never decrypts candidates or emits source
URLs. Redis keys expire independently and cleanup may only remove keys in TikDD-owned namespaces.

Cleanup has dry-run/count mode, batch and time budgets, retry-safe operations, rows/duration/error
metrics, and a distributed singleton lease. Failure leaves data logically inaccessible and raises a
sanitized operational alert; it does not extend public usability. Idempotency expiry is coordinated
with task retention so a replay never points to a hard-deleted task.

### 9. Keep public errors stable and operator metadata private

Work items 9.2 and 9.3 update OpenAPI and `@tikdd/contracts` together. The public boundary adds only
generic admission outcomes:

| HTTP | Code | Meaning |
| --- | --- | --- |
| `409` | `IDEMPOTENCY_CONFLICT` | The key was already used for a different request |
| `429` | `RATE_LIMITED` | The anonymous request allowance is exhausted |
| `429` | `DUPLICATE_IN_PROGRESS` | An equivalent source is already being processed |
| `429` | `CONCURRENCY_LIMITED` | The caller or service has too many active tasks |
| `503` | `ADMISSION_UNAVAILABLE` | Required admission controls cannot make a safe decision |

`429` responses carry a bounded `Retry-After`. Messages are localized in the Web, remain
actionable, and contain no provider, rule, circuit, quota key, address digest, existing task, or
internal capacity details. Task and result routes remain non-indexable.

Protected diagnostics may expose rollout revision, matched rule metadata, aggregate rejection
counts, and cleanup health. They never expose raw/digested idempotency keys, canonical fingerprints,
network-address digests, submitted URLs, media metadata, delivery secrets, or per-caller histories.

## Invariants

1. Circuit health never grants production authorization, and rollout policy never overrides a
   manifest, terminal error, route budget, or delivery host policy.
2. Every production provider route requires a current affirmative rule; every matching emergency
   deny wins.
3. Mock providers refuse production regardless of rollout configuration.
4. Percentage rollout is deterministic from opaque task data and never hashes a source URL or IP.
5. Raw idempotency keys, source fingerprints, network addresses, and forwarding headers are never
   logged or stored as plaintext operational data.
6. One idempotency key and request create at most one durable task and one queue job.
7. Canonical deduplication never returns another anonymous caller's task capability or result.
8. Untrusted forwarded-address headers cannot change quota identity.
9. Missing mandatory admission state fails public task creation closed; missing inferred health
   retains ADR-0006's bounded fail-soft behavior.
10. Logical expiry is enforced on every read even if physical cleanup is late.
11. Cleanup and distributed permits are bounded, retry-safe, and scoped to TikDD-owned records.
12. Public contracts reveal no provider-control, quota-identity, deduplication, or cleanup metadata.

## Rejected alternatives

### Keep provider enablement only in environment variables

Rejected because a restart is too slow for an emergency stop and changes have no durable revision,
reason, or rollback history.

### Use Redis as the rollout source of truth

Rejected because rollout permission and operator audit must survive eviction and Redis replacement.
Redis remains an expiring distribution cache.

### Let missing rollout state fall back to manifest enablement

Rejected for production because loss of explicit authorization would silently enable traffic. This
is intentionally stricter than fail-soft inferred health.

### Hash the canonical URL directly for rollout and deduplication

Rejected because public URLs are enumerable and an unkeyed digest permits dictionary recovery.
Domain-separated server-keyed HMACs are required.

### Return the existing task when any caller submits the same canonical URL

Rejected because an opaque task ID is a capability and the result can contain identifying media
metadata. Only a matching idempotency key may replay that capability.

### Trust every `X-Forwarded-For` value

Rejected because callers could choose quota identities and bypass per-address controls. Proxy trust
is deployment-specific reviewed configuration.

### Disable quotas when Redis is unavailable

Rejected because a control-plane incident would become an unlimited public task-ingestion path.
Submission fails closed while worker health reads keep their separate fail-soft policy.

### Run cleanup as one large cascading transaction

Rejected because it creates long locks, vacuum pressure, unpredictable latency, and difficult
recovery. Cleanup is incremental and logically expired data is already inaccessible.

## Consequences

- Work item 9.1 adds durable rollout rules/audit, compiled Redis snapshots, deterministic cohorting,
  and a protected emergency-change path.
- Work item 9.2 changes task persistence and the public submission contract for idempotency and
  active-source admission; OpenAPI and `@tikdd/contracts` change together.
- Work item 9.3 replaces unrestricted proxy trust and adds privacy-preserving Redis quotas and
  distributed concurrency permits.
- Work item 9.4 adds scheduled bounded cleanup and retention verification.
- Work item 9.5 may extend protected diagnostics and canaries within the metadata-only boundary.
- Redis becomes mandatory for safe public task admission, while PostgreSQL remains the source of
  truth for tasks, idempotency, rollout policy, and audit.
- Anonymous canonical requests are suppressed rather than shared, trading some cache efficiency for
  capability and metadata isolation.

## Implementation and verification order

1. Add runtime-validated rollout contracts, PostgreSQL rules/audit, Redis snapshots, deterministic
   cohorts, deny precedence, stale-state handling, and production-mock tests.
2. Add `Idempotency-Key` parsing, domain-separated digests, transactional task creation, active
   canonical admission, queue-race tests, and coordinated OpenAPI/contracts changes.
3. Replace unrestricted proxy trust; add normalized-address HMAC quotas, active-task counters,
   provider concurrency leases, spoofing tests, and Redis-failure tests.
4. Add singleton bounded cleanup, retention policy, dry-run metrics, cascade verification, and
   repeated-run tests.
5. Extend protected diagnostics and authorized canaries without adding consumer provider details.
6. Run Docker-backed concurrency, duplicate, quota, kill-switch, stale-control, cleanup, and failure
   tests followed by `pnpm check` before marking work item 9 complete.

## Implementation status

Work item 9.0 accepted this boundary on 2026-08-09 without changing runtime behavior. The following
work items implement each portion with their required migrations and tests.

Work item 9.1 implemented the rollout portion on 2026-08-09. `@tikdd/rollout-control` owns runtime
schemas, deny-first evaluation, deterministic task cohorts, revisioned Redis snapshots, durable
fallback, stale-state denial, and rollback prevention. Migration `0005` adds current rules and
append-only audit history. The worker applies rollout before circuit health, refuses production
mocks independently, refreshes the durable revision every five seconds, and exposes only a direct
operator command outside public OpenAPI. At that point, anonymous quota, distributed provider
concurrency, and cleanup remained future work items.

Work item 9.2 implemented task idempotency and active-source admission on 2026-08-09. Public
contracts and OpenAPI now define the optional bounded `Idempotency-Key` plus generic `409`, `429`,
and `503` outcomes. Domain-separated server-keyed HMACs protect key, request, and canonical-source
identities. Migration `0006` adds task-bound expiring records. Deterministically ordered advisory
locks make concurrent first use transactional; only the created winner enqueues a task-ID-keyed
BullMQ job. Replays return the same task, conflicts reveal no task, and different callers receive
only a bounded duplicate response. Terminal tasks release source admission without deleting the
idempotency replay record. At that point, quota identity, distributed provider concurrency, and
general cleanup remained future work items.

Work item 9.3 implemented trusted-proxy identity, anonymous Redis quotas, active-task permits, and
provider concurrency on 2026-08-09. The API now disables unrestricted Fastify proxy trust, accepts
forwarded addresses only through exact reviewed CIDRs, rejects ambiguous chains, and stores only a
domain-separated address HMAC in expiring Redis keys. One Lua operation applies client/global rate
and active-task limits; provisional task permits are released on non-winning admission paths and
terminal worker outcomes. Provider calls acquire owner-scoped leases for the exact provider,
platform, and region. Busy tuples fall through sequentially without consuming the attempt budget or
half-open probe. Public `RATE_LIMITED`, `CONCURRENCY_LIMITED`, and `ADMISSION_UNAVAILABLE` responses
remain capability-safe. At that point, general cleanup and expanded protected diagnostics remained
future work.

Work item 9.4 implemented bounded physical cleanup on 2026-08-09. Migration `0007` adds stable
compound indexes without changing retained data or public contracts. The separately deployable
`@tikdd/cleanup` process uses a deployment-scoped owner lease, fixed stage order, one small
`SKIP LOCKED` transaction per batch, statement/run/batch budgets, and configurable hard retention.
Dry-run and execution expose only sanitized row/duration/error metrics. Docker verification proves
lease contention, no-write counting, task cascade, fresh-row preservation, and zero-change repeat.
OpenAPI and `@tikdd/contracts` remain unchanged because no serving contract changed. Expanded
protected diagnostics remain future work.

Work item 9.5 implemented the metadata-only canary and protected diagnostics boundary on 2026-08-09.
Migration `0008` stores expiring sanitized canary outcomes without URLs, media metadata, provider
payloads, or delivery secrets. The independent scheduler requires explicit authorization, an
isolated canary region, an audited affirmative rollout rule, circuit evaluation, distributed
provider concurrency, sequential fallback, and a Redis singleton lease. The protected diagnostics
route now combines manifest priority, rollout revision/rules, circuit state, categorized failures,
aggregate fallback depth, and canary health. It remains outside public OpenAPI/Web. Docker
verification covers persistence, aggregation, lease ownership, and bounded expiry cleanup.

Work item 9.6 closed the ADR implementation on 2026-08-09. `pnpm verify:work-item-9` runs the full
PostgreSQL/Redis matrix for migrations, emergency denial, stale and unavailable rollout state,
idempotent concurrency, capability-safe duplication, quota and provider permits, circuit recovery,
bounded cleanup, and canary retention, then runs `pnpm check`. The gate passed all eight stages with
27 test files and 106 tests, and is now the GitHub CI job with service containers. Work item 9 is
complete; production policy calibration and staged provider rollout remain separate operations.
