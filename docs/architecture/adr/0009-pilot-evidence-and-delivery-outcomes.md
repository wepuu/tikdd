# ADR-0009: Pilot evidence, delivery outcomes, and restrictive evaluation

- Status: Accepted
- Date: 2026-08-10
- Scope: work item 11 pilot evidence and delivery-outcome boundary
- Extends: ADR-0005, ADR-0006, ADR-0007, and ADR-0008

## Context

TikDD already persists a sanitized provider-attempt ledger, expiring canary measurements, locked
pilot policies, restrictive guard state, and append-only guard audit. The existing evaluator can
hold, reduce, deny, or mark a route eligible for operator review. It intentionally cannot grant
traffic or raise an allocation.

Those controls were implemented with synthetic aggregate evidence so the authorization and rollback
boundary could be tested before a real pilot. They do not yet define how production observations
become evidence. In particular, the current contracts leave room for queue retries to inflate a
sample, canaries to be mixed with user traffic, partial local-calendar days to be called complete,
and delivery events to acquire identifiers that would recreate a task or media history.

Work item 11.4 will add persistence, aggregation, and a scheduled evaluator. Before that code exists,
TikDD needs one decision-complete boundary for attribution, time windows, late data, retention,
replay, delivery-outcome privacy, evaluator ownership, and protected evidence access. Numeric
provider SLO thresholds are deliberately not selected here; ADR-0008 requires those values to come
from three complete days of reviewed internal observations.

## Decision

### 1. Key every evidence cell by an exact tuple and observation class

The indivisible evidence key is:

```text
(provider_id, platform_slug, actual_worker_region, observation_class, utc_day)
```

`observation_class` is one of:

| Class | Source | May satisfy internal calibration or public promotion samples |
| --- | --- | --- |
| `canary` | Explicit authenticated canary execution | No |
| `internal` | Reviewed owner/team cohort admitted by an internal rollout subject | Internal calibration only |
| `public` | External request admitted by the public rollout rule | Limited/stable review only |

The class is fixed at task admission or canary creation and carried as server-side execution
context. A request cannot select it with a public header, query field, locale, URL, or browser state.
Region is the concrete Worker execution region at the time of the provider attempt; deployment
configuration must reject `"*"`, aliases, and an absent region. Provider and platform come from the
validated route attempt, not from a provider payload or caller claim.

Evidence is never combined across providers, platform slugs, regions, or observation classes to
satisfy a sample minimum. A route-level report may present several exact cells together, but it
must retain each cell and denominator. Moving a deployment to another region starts a new evidence
history. Renaming a provider or platform requires an explicit reviewed migration; aggregation does
not infer aliases.

Resolution attribution occurs when the task reaches a durable terminal route outcome. Delivery
attribution is copied from the immutable internal candidate context before that context is removed;
the delivery-outcome row stores only the exact tuple and class, not the candidate or task reference.
Policy and taxonomy versions used to interpret a row are recorded as bounded version numbers.

### 2. Count one resolution sample per distinct task and tuple

For one exact provider/platform/region/class cell, a task contributes at most one resolution sample
per UTC day. The aggregation transaction may read the existing opaque `task_id` to deduplicate
provider attempts, but neither daily evidence nor an export stores a task ID or a reversible task
fingerprint.

Repeated attempts caused by BullMQ retry, Worker restart, lease loss, or an idempotent replay are
collapsed as follows:

1. group attempts by task and exact provider/platform/region tuple;
2. treat the group as successful only when at least one attempt produced the normalized result that
   was committed for that task;
3. otherwise select one normalized failure class by the fixed precedence `absolute-stop or
   boundary violation`, `terminal content/policy`, `invalid-result/schema`, `challenge/rate-limit`,
   `timeout/network`, then `other`; ties use the latest `finished_at` and ledger ID;
4. measure normalized latency from the earliest start in the group to the committed success, or to
   the selected terminal finish, capped at the route deadline;
5. count fallback depth from ordered distinct provider IDs in the committed route execution;
   repeating the same provider does not add depth.

A task that crosses UTC midnight is assigned to the UTC day containing its durable terminal route
outcome. An unfinished task contributes nothing. A later queue replay of an already terminal task
cannot move the sample to another day. A task may contribute one sample to each different provider
tuple it actually contacted, which preserves real sequential fallback evidence without converting
multiple attempts at the same provider into independent volume.

Distinct resolution tasks are the only sample count allowed to satisfy a policy's minimum sample
requirement. Attempt count, canary count, delivery click count, ticket count, and browser handoff
count are diagnostic denominators and cannot substitute for distinct tasks. Terminal private,
authenticated, paid, DRM, geographic, not-found, and unsupported-URL outcomes remain capability or
policy counts; they do not enter the provider-availability denominator and fallback cannot bypass
them.

### 3. Persist delivery outcomes as unlinkable, bounded events

Delivery records use a random opaque outcome ID generated for the operation. The allowed fields
are:

- outcome ID;
- provider ID, platform slug, actual Worker region, and observation class;
- delivery mode (`redirect`, and future reviewed modes only);
- stage and normalized result class from the tables below;
- bounded duration in milliseconds, capped at the delivery operation deadline;
- occurred, ingested, and hard-expiry timestamps;
- delivery-policy and outcome-taxonomy versions.

The allowed stage/result combinations are:

| Stage | Normalized results | Meaning |
| --- | --- | --- |
| `ticket_creation` | `succeeded`, `candidate_missing`, `candidate_expired`, `task_unavailable`, `rejected`, `internal_error` | The delivery service accepted or safely refused one ticket request. |
| `redirect_validation` | `passed`, `ticket_invalid`, `ticket_expired`, `candidate_expired`, `host_rejected`, `dns_rejected`, `mode_rejected`, `internal_error` | The one-use redemption boundary completed policy validation or failed closed. |
| `ticket_expiry` | `expired_unredeemed` | A ticket became logically expired without a successful handoff. |
| `browser_handoff` | `redirect_issued` | TikDD atomically redeemed the ticket and issued the reviewed redirect. |

`redirect_issued` proves only a TikDD browser handoff. It does not claim that the browser followed
the redirect, that the CDN returned bytes, or that a file was saved. Client analytics, service
workers, download-completion beacons, and media GETs are not added to manufacture that claim.

Delivery outcomes must not contain task ID or digest, submitted/canonical/target URL, candidate ID
or digest, format ID, media facts, ticket/token/hash, caller/session/network identity, host or DNS
answer, redirect location, header, cookie, provider payload, byte body, free-form error, or stack
trace. They have no foreign key to tasks, candidates, tickets, or provider-native records. Logs and
traces apply the same prohibition.

Ticket creation, redemption, and expiry emit at most one event for their state transition. When a
ticket exists, its existing private row owns the transactional `outcome_emitted` marker until
cleanup; the evidence row still receives no ticket reference. A replay that observes the marker is
a no-op. A ticket-creation failure uses one operation-scoped random outcome ID and one database
transaction. Delivery events never satisfy the distinct-task minimum, and canary/internal/public
delivery rates remain separate, so repeated clicks or canaries cannot grant traffic.

### 4. Aggregate into UTC calendar days with explicit completeness

All evidence uses UTC. A daily bucket is the half-open interval `[00:00:00Z, next 00:00:00Z)` and
is identified by its UTC date. Deployment locale and PostgreSQL session time zone cannot alter the
bucket. Rates use integer numerators and denominators; basis points are derived only at read time so
replay does not accumulate rounding error. Percentiles are rebuilt from bounded latency histogram
buckets, not averaged from earlier percentiles.

Each daily summary stores only:

- the exact cell key and UTC bounds;
- schema, taxonomy, aggregation, and source-watermark versions;
- distinct resolution-task count and committed success/failure-class counts;
- bounded latency histogram plus derived p50/p95;
- route deadline, unique-provider fallback-depth, and candidate-coverage counts;
- ticket creation, redirect validation, ticket expiry, and browser handoff counts by normalized
  result;
- first/last source occurrence, aggregate generation time, source watermark, completeness state,
  and aggregate revision.

No source identifier, opaque outcome ID, actor, URL, media value, secret, free-form text, or raw
payload crosses into the daily summary.

A bucket is:

- `open` until its UTC end;
- `complete` after UTC end when the aggregator has processed all source rows with `ingested_at`
  through its recorded watermark;
- `sealed` 48 hours after UTC end and after a successful replay through that watermark.

The aggregator runs at least every five minutes, is idempotent, and may replace an `open` or
`complete` summary with a higher revision. It never mutates a `sealed` row in place. Source data
arriving more than 48 hours after its event day is quarantined as a bounded `late_after_seal` count
for the current processing day, excluded from historical qualification, and reviewed if it would
have changed a restrictive decision. No raw value is copied into that quarantine count.

### 5. Use fixed windows for calibration and promotion

An evidence window always contains consecutive UTC buckets for one exact tuple and one observation
class. It cannot skip an unhealthy or insufficient day.

- **Internal calibration:** exactly three consecutive `sealed` internal days after the tuple entered
  `internal`. Each day must meet the reviewed minimum distinct-task rule. The policy proposal cites
  all three daily revisions. If any day is insufficient, calibration restarts at the next possible
  three-day sequence; canary and public rows do not fill the gap.
- **Restrictive evaluation:** the active policy selects an integer lookback of 1–7 consecutive
  `complete` or `sealed` days ending at the latest completed UTC boundary. The numeric lookback,
  minimum samples, thresholds, maximum evidence age, stale action, rollback allocation, and cooldown
  are locked policy fields. `open` current-day data may trigger an absolute stop through existing
  security, circuit, or emergency-deny controls, but it cannot be called a healthy pilot window.
- **External promotion/recovery review:** seven consecutive `sealed` public days after the current
  operator checkpoint, with sufficient samples and seven reviewed healthy daily results. Evidence
  collected before the grant or at a different allocation is not used to satisfy the next
  checkpoint. The checkpoints remain internal, 5%, 25%, 50%, and 100%.

The three-day calibration determines numeric SLO proposals; this ADR supplies no fabricated success,
latency, challenge, invalid-result, delivery, or expiry threshold. The Evidence owner reviews the
proposal, source versions, exclusions, sufficiency, and baseline distribution. A different opaque
reviewer locks it with optimistic concurrency. Editing any window, taxonomy, threshold, sample,
freshness, cooldown, or stale-action value creates a new policy version and requires a new three-day
calibration proposal. A locked version is immutable and activates only after its review time.

Missing, insufficient, unsealed, mixed-class, stale, or version-incompatible evidence is never
healthy. Before public traffic it holds qualification and blocks promotion. During public traffic
the evaluator applies the locked `staleAction` and may only retain or reduce the effective cap.

### 6. Make replay deterministic and retention bounded

PostgreSQL is authoritative. The daily aggregate is a deterministic projection of source rows and
versioned classification rules. Replaying the same tuple/day/watermark/version replaces the same
summary revision contents and never adds counts to existing counts. Concurrent rebuilds use
optimistic revision checks; a stale writer loses and retries from the newer watermark.

Retention is fixed for the first pilot:

| Record | Retention |
| --- | --- |
| Sanitized delivery outcomes | 35 days after `occurred_at` |
| Canary measurements | Existing configured expiry, never extended for pilot evidence |
| Provider attempts/tasks | Existing task hard retention; aggregation must finish before deletion |
| Daily evidence summaries | 400 days after UTC day end |
| Calibration proposals and policy-lock reviews | 400 days after rejection, supersession, or policy expiry |
| Guard and qualification audit | 400 days after the referenced policy expires |
| Current policy, guard, and qualification state | While active, then the applicable 400-day audit retention |
| Generated evidence export | No server-side artifact; response lifetime only |

Logical expiry applies on every evidence read. The cleanup singleton adds stable, indexed stages for
expired delivery outcomes, summaries, and review/audit records; it uses the ADR-0007 batch, lease,
statement-time, and dry-run rules. Cleanup must not delete source rows before their UTC bucket is
sealed. Retained sealed summaries remain auditable after their raw replay horizon ends. If source
retention is shorter than the seal window plus one successful aggregation interval, startup and
preflight fail closed.

Deleting raw evidence does not change a sealed aggregate. Replaying a day after its source-retention
boundary is prohibited and reported as `source_expired`; it cannot silently publish zeros. Schema or
taxonomy migration uses a new aggregation version and parallel rebuilt rows while sources exist,
followed by an explicit reviewed cutover. It never rewrites historical evidence to hide a prior
decision.

### 7. Give the scheduled evaluator one restrictive owner

Work item 11.4 adds an independently scheduled singleton evaluator, separate from Web, API,
resolver Workers, delivery, and cleanup. PostgreSQL advisory or lease-backed ownership uses a
deployment-scoped opaque owner token and bounded TTL. The default cadence is five minutes with one
bounded pass; overlapping invocations do not evaluate the same tuple concurrently.

For each active exact tuple the evaluator reads, in one consistent database view:

1. current qualification and approval state;
2. current operator grant and every applicable deny;
3. one active locked policy version;
4. latest eligible evidence window and revisions;
5. current guard revision and cooldown state.

It writes a guard and append-only audit only when the action, reason, evidence revision, freshness,
or cap changes. The write requires the expected guard revision, policy version, evidence revisions,
and operator-grant revision. A conflict aborts that tuple and schedules a fresh read; it never
blindly overwrites newer operator or evaluator state. Snapshot publication occurs only after commit
and refuses an older global revision.

An evaluator may hold, reduce, deny, extend an existing restriction, or mark
`eligible_for_review`. It cannot create approval or a rollout grant, advance qualification, clear a
pause/deny, raise a guard cap, change policy, or restore traffic. An absolute stop does not wait for
sample sufficiency or cooldown. Stale evidence follows the locked stale action. Insufficient data
holds before public rollout; during active public rollout it reduces or denies as the policy says.

After a reduction or deny, healthy evidence must cover the policy's full cooldown and required
sealed recovery days. The evaluator then records only `eligible_for_review` at the existing cap.
Recovery requires an operator to review the incident, current approval, fresh evidence revisions,
policy, grant, and guard revisions. The operator may clear or replace the guard with optimistic
concurrency, but any increase still requires a separate rollout-rule action and cannot exceed the
reviewed checkpoint.

Evaluator database loss, missing policy, ambiguous active policies, invalid aggregate versions,
expired approval, stale grant, publication failure, or clock regression is not healthy evidence.
The current valid restrictive snapshot remains until its TTL; after that, the Worker's required-guard
boundary fails closed. Operator recovery starts with a dry-run report and may republish durable
state, but never reconstructs permission from Redis.

### 8. Keep diagnostics and exports aggregate-only

Evidence access is a protected operator surface with an independent credential and authorization
scope. Responses use `Cache-Control: no-store`, are absent from public OpenAPI and sitemaps, and are
served with `X-Robots-Tag: noindex, nofollow`. Consumer Web routes and localized copy receive none
of these fields.

Protected diagnostics may expose exact tuple/class, UTC window bounds, completeness, freshness,
aggregate revision, policy version, integer aggregate counts/rates/histograms, sufficiency, guard
cap/action/reason, and cleanup/evaluator health. They do not expose raw events, source IDs, outcome
IDs, task/candidate/format/ticket data, callers, actor IDs, approval references, URLs, hosts, DNS,
media, headers, cookies, payloads, or free-form errors.

Evidence export is an on-demand stream of retained daily summaries for an explicit tuple, class,
and maximum 31-day UTC range. It uses the same field allowlist, records a sanitized access audit,
sets `no-store`, and leaves no server-side export file. Canary, internal, and public rows are never
merged. Policy proposals and operator audits require separate scopes and are not embedded in an
evidence export.

Public metrics may report fleet-wide service totals only after a separate privacy review. This ADR
does not authorize per-provider, per-platform, per-region, rollout, guard, or evidence data in
public analytics.

## Invariants

1. Evidence is exact-tuple and exact-class; canary, internal, and public observations never satisfy
   one another's sample minimums.
2. One task contributes at most one resolution sample to a provider tuple/day, regardless of queue
   retry, Worker restart, or repeated provider attempts.
3. Only distinct resolution tasks satisfy policy sample sufficiency; delivery and canary volume
   cannot manufacture it.
4. Daily boundaries are UTC half-open intervals, and calibration/promotion use consecutive sealed
   days without skipping unhealthy or insufficient days.
5. Missing, insufficient, stale, unsealed, or incompatible evidence never counts as healthy.
6. Delivery outcomes contain no task, URL, candidate, format, media, ticket, caller, network, host,
   header, cookie, payload, or free-form error data and cannot be joined back to those records.
7. A browser handoff means TikDD issued a validated redirect, not that media bytes or a saved file
   were observed.
8. Replay is replacement by tuple/day/watermark/version, never additive, and sealed history is not
   silently rewritten.
9. Automation can only hold, reduce, deny, or request operator review; it cannot grant, promote,
   clear a restriction, or raise traffic.
10. PostgreSQL is authoritative; Redis carries only an expiring revisioned guard snapshot.
11. Cleanup is bounded and cannot remove source data required to seal or reproduce retained
    evidence.
12. Diagnostics and exports are protected, aggregate-only, `no-store`, and absent from public
    contracts and SEO surfaces.

## Rejected alternatives

### Count provider attempts as independent samples

Rejected because queue retries and Worker recovery could manufacture both volume and apparent
reliability. The denominator is one committed task outcome per exact provider tuple.

### Mix canaries with sparse public traffic

Rejected because scheduled synthetic success could hide a failing user route. Canary evidence is a
separate operational signal and never fills an internal or public sample gap.

### Store a task, candidate, format, or ticket digest on delivery outcomes

Rejected because a stable digest remains a join key and recreates a delivery history. Transactional
markers stay on the existing private source row only until its normal cleanup.

### Use deployment-local calendar days

Rejected because daylight-saving and region changes create overlapping or missing windows and make
cross-region review ambiguous. Every bucket is UTC.

### Treat the current partial day as a healthy promotion window

Rejected because partial traffic and late events make the denominator unstable. Only sealed days
support calibration, recovery, and promotion.

### Automatically restore the previous operator allocation after recovery

Rejected by ADR-0008 and reaffirmed here: clearing a restriction increases effective traffic and
requires operator review plus a separate rollout action.

### Retain raw delivery events indefinitely for investigations

Rejected because the events are useful only for bounded aggregation and incident review. Thirty-five
days supports the pilot windows and replay watermark without building a long-lived behavior history.

## Consequences

- Work item 11.4 must add source and aggregate migrations, repositories, cleanup stages, versioned
  aggregation, and the independent evaluator without changing public OpenAPI.
- Existing synthetic `PilotEvidence` fixtures remain control tests; they are not operational
  evidence until produced from the accepted aggregate boundary.
- The policy schema must gain explicit evaluation-day, class, freshness, cooldown, taxonomy, and
  aggregate-version fields before a real policy can be locked.
- Delivery must write normalized outcomes transactionally while keeping all task/candidate/ticket
  linkage inside its existing private state.
- Sparse pilot traffic can extend calibration or promotion indefinitely; time passing alone never
  creates sufficient evidence.
- The first real policy still requires independent production/commercial approval and three sealed
  internal days. This ADR enables that work but grants no traffic.

## Implementation and verification order

1. Add runtime-validated internal evidence models and forbidden-field/privacy tests.
2. Add delivery-outcome, daily-summary, calibration-proposal, and review migrations with cleanup
   indexes and logical-expiry reads.
3. Emit transactionally deduplicated ticket creation, validation, expiry, and browser-handoff
   outcomes without public contract changes.
4. Implement exact-tuple/class UTC aggregation, distinct-task collapse, histograms, watermarks,
   late-data handling, and deterministic replay.
5. Extend the locked policy and evaluator for version compatibility, scheduled singleton ownership,
   stale/insufficient decisions, cooldown, optimistic concurrency, and recovery review.
6. Publish only expiring restrictive snapshots and add protected aggregate diagnostics/export.
7. Verify migrations, privacy residue, replay, cleanup, stale state, absolute stops, reduction,
   operator-deny precedence, and non-restoring recovery in Docker, then run `pnpm check`.
