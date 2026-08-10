# ADR-0008: Provider qualification, pilot evidence, and bounded rollback controls

- Status: Accepted
- Date: 2026-08-10
- Scope: work item 10 controlled X pilot
- Extends: ADR-0004, ADR-0005, ADR-0006, and ADR-0007

## Context

TikDD can recognize X URLs, route sequentially through provider manifests, persist normalized
results and encrypted delivery candidates, issue one-use redirect tickets, derive tuple-keyed
circuit health, and enforce audited percentage rollout. Work item 9 also added admission limits,
cleanup, metadata-only canaries, and protected diagnostics.

Those controls do not yet answer whether a real provider is qualified to progress from fixture work
to public traffic, how pilot SLOs are calibrated, which evidence permits promotion, or how an
automatic rollback may interact with operator-authored rollout rules. A healthy circuit is not
production approval. A current rollout grant is not evidence that every returned format has a safe
delivery candidate. Sparse or stale observations must not make a provider appear ready.

TwitterSaver currently has one reviewed redirect host policy and a successful bounded X canary.
DLPanda declares X capability but currently emits no delivery candidates and encountered a
provider challenge in the reviewed execution region. Both provider records authorize bounded
technical tests only; neither record establishes production or commercial approval. DLPanda is
therefore a qualification candidate, not a predetermined second production provider.

The current canary configuration authorizes provider/input pairs rather than a reusable pool of
URLs: TwitterSaver is paired with the X input and DLPanda with the TikTok input. It does not
authorize sending the existing X input to DLPanda. Work item 10.1 must record an explicit
DLPanda/X pair, or another selected provider/X pair, before that live network request occurs.

Work item 10 needs two real, deliverable X providers and a staged rollout with bounded automatic
rollback. This decision must preserve the established separation between provider capability,
production permission, inferred health, delivery policy, and the public product experience.

## Decision

### 1. Track qualification separately from runtime rollout and platform status

Every real provider/platform/region route moves through this qualification lifecycle:

```text
candidate → fixture-ready → canary-ready → internal → limited → stable
       \__________________________________________________________/
                                ↓
                              paused
```

The stages mean:

| Stage | Meaning | Traffic permitted |
| --- | --- | --- |
| `candidate` | A provider record and named owner exist; feasibility is unproven. | None |
| `fixture-ready` | Manifest, normalization, failure decisions, and sanitized fixtures pass deterministic tests. | None |
| `canary-ready` | Bounded technical-test authorization, reviewed hosts, canary input, and safety gates exist. | Explicit canary only |
| `internal` | Production/commercial approval and complete delivery mapping exist; controlled owner/team traffic may calibrate evidence. | Audited internal cohort only |
| `limited` | Locked pilot policy and sufficient fresh evidence permit an operator-defined external percentage. | Audited percentage grant |
| `stable` | All pilot gates and the minimum observation window pass for the exact tuple. | Up to the reviewed operator grant |
| `paused` | An approval, security, health, evidence, or operator condition blocks new attempts. | None |

`paused` is a deny override that retains the last achieved stage and reason. Removing the pause does
not advance the provider and cannot resume above its previous operator-approved allocation. The
route is re-evaluated against current approval, evidence freshness, manifest, host policy, circuit,
and rollout state before it resumes.

Qualification is not the platform catalog status. A stable provider route does not automatically
make X an indexable `stable` catalog entry, and catalog recognition cannot advance qualification.
Qualification is also not circuit state: a closed circuit supplies health evidence but never grants
traffic.

The version-controlled provider record documents the reviewed state, scope, owners, approval
status, evidence references, and policy versions. Runtime still requires immutable deployment
prerequisites and ADR-0007 rollout authorization. Documentation alone cannot enable a process.

### 2. Keep technical-test authorization independent from production approval

Each provider record contains separate, explicit statuses for:

- technical-test authorization, including provider integration and named canary inputs;
- production/commercial approval, including platform and region scope;
- credentials and data-retention approval, even when the answer is "none";
- page-host and media-host policy review;
- qualification owner, evidence owner, rollout operator, and rollback owner;
- review date, expiry or re-review date, and an opaque external evidence reference when applicable.

The repository stores status and an opaque reference, not contracts, legal correspondence,
credentials, personal data, or secret evidence. Missing, expired, revoked, or out-of-scope
production approval prevents `internal`, `limited`, and `stable` traffic regardless of health or an
existing rollout grant.

Technical-test authorization permits only the named bounded canary workflow. It does not authorize
arbitrary user URLs, public traffic, challenge bypass, account cookies, or credentials. A provider
that requires user credentials, challenge solving, an unbounded host wildcard, or an unimplemented
delivery mode cannot advance to `internal`.

A content URL authorized for one provider/platform pair is not implicitly authorized for another
provider, even when both integrations and the content are separately named in the same record. The
canary configuration must contain the exact provider, platform, and input pairing.

Initially one person may hold more than one owner role, but each automated or operator action still
records its specific role and opaque actor ID. Secrets, URLs, media titles, and personal names are
not valid actor or change-reason fields.

Responsibilities are fixed even when the deployment-specific actor IDs change:

| Owner role | Accountable decision |
| --- | --- |
| Qualification owner | Provider record, approval scope, manifest and host-policy readiness, and stage review |
| Evidence owner | Metric definitions, sample sufficiency, three-day calibration, policy proposal, and daily evidence review |
| Rollout operator | Manual stage promotion, allocation increase, guard-clear approval, and optimistic revision check |
| Rollback owner | Guard alerts, emergency deny rehearsal, incident ownership, cooldown, and recovery recommendation |

Work item 10.1 records concrete opaque owner IDs for the selected provider and tuple. Missing owner
assignment holds qualification at `candidate`; the ADR does not invent personal identities.

### 3. Require complete resolution and delivery evidence before internal traffic

A route cannot advance beyond `canary-ready` unless all production results meet the ADR-0005
candidate boundary:

1. every public format maps to exactly one internal candidate;
2. every candidate uses a TikDD-owned, versioned `hostPolicyId`;
3. the policy admits only reviewed HTTPS hosts and delivery modes;
4. every DNS answer and redirect behavior passes the delivery validation appropriate to the mode;
5. required provider headers or cookies do not cross into redirect mode;
6. candidate, task, and ticket expiry remain bounded and cleanup-safe;
7. terminal private, authenticated, paid, DRM, policy, or geographic outcomes create no candidate;
8. provider-native payloads and direct URLs stay out of public contracts, attempts, metrics, and
   evidence.

An adapter may remain useful for fixture or canary feasibility while producing resolution-only
output, but it is not production-complete and cannot count as the second real pilot route.

### 4. Build pilot evidence from sanitized, attributable sources

Qualification evidence is calculated for the exact provider, platform, and actual worker region,
plus route-level and delivery-level aggregates where required. It uses these sources:

- durable sanitized provider attempts from ADR-0006;
- expiring metadata-only authorized canary measurements;
- sanitized delivery outcomes for ticket creation and redirect-policy validation;
- rollout revision, qualification stage, policy version, and automated-guard revision;
- deterministic fixture, routing, security, and product-flow gate results.

The delivery outcome model records only opaque outcome ID, provider/platform/region tuple, mode,
normalized result class, bounded latency, timestamps, policy version, and expiry. It must not store
task ID, submitted or canonical URL, format ID, media metadata, candidate ID or URL, ticket, DNS
answers, headers, cookies, caller identity, or raw error text. A later implementation may persist
these outcomes in PostgreSQL with bounded retention and cleanup indexes; public OpenAPI and Web
contracts never expose them.

Required pilot measures are:

- resolution success rate and p50/p95 time to normalized formats;
- categorized challenge, rate-limit, timeout, schema-change, and invalid-result rates;
- route success, average/p95 fallback depth, and route deadline rate;
- public-format-to-candidate coverage;
- delivery-ticket creation success and redirect-policy validation success;
- candidate lifetime sufficiency for the observed user journey;
- product funnel counts for recognized, submitted, ready, and delivery-requested states only when
  they contain no URL, media, provider, or caller data.

Provider evidence never treats content-not-found, private, authenticated, paid, DRM, geographic,
or unsupported-URL outcomes as provider availability failures. They remain visible as sanitized
capability or policy counts and preserve their terminal/fallback decisions.

### 5. Calibrate for three complete internal days before locking numeric SLOs

TikDD does not invent provider SLO thresholds before observing the authorized internal pilot. The
`internal` stage collects at least three complete consecutive 24-hour windows for each reviewed
tuple. A versioned pilot policy is then proposed and reviewed with:

- numerator, denominator, aggregation window, and failure taxonomy for every measure;
- minimum distinct-task and canary sample sizes;
- target, warning, rollback, and absolute-stop conditions;
- maximum evidence age and missing-data behavior;
- promotion observation period and rollback cooldown;
- policy author, reviewer, activation time, and superseded version.

Each measure reports sample sufficiency. Insufficient samples hold the current stage and allocation;
they never count as success. Queue retries of one task do not manufacture independent samples.
Canaries are labeled separately from user-route observations so a high canary frequency cannot hide
poor route behavior.

The following absolute conditions need no statistical minimum and cause or preserve a pause:

- approval is missing, expired, revoked, or outside scope;
- a development mock participates in a production route;
- an unreviewed host, mode, redirect, credential, or private-network target is observed;
- a secret, direct URL, provider payload, or prohibited identifier crosses a public or evidence
  boundary;
- terminal content/policy decisions are bypassed through fallback;
- rollout authorization or its audit source is missing or stale beyond ADR-0007 limits.

Other error, latency, challenge, delivery, and integrity triggers use the locked policy and its
sample rules. Stale evidence blocks promotion. If evidence remains stale beyond the locked maximum
while external traffic is active, the automated guard reduces the route to its last recorded
healthy allocation or denies it according to policy.

### 6. Separate operator grants from automatic reduction guards

ADR-0007 operator-authored rollout rules remain the only mechanism that can grant traffic or raise
an allocation. Automatic evaluation uses a separate, expiring, revisioned guard keyed by provider,
platform, and region.

The effective allocation is:

```text
min(operator grant allocation, automatic guard cap)
```

An automatic guard may:

- hold the current effective allocation;
- reduce it to a previously recorded healthy allocation;
- set it to zero and deny new provider attempts;
- extend a reduction or deny while evidence is stale or unhealthy.

An automatic guard may not:

- create a rollout grant or provider capability;
- enable a disabled manifest or bypass a production-approval prerequisite;
- widen platform, region, timeout, delivery mode, or host policy;
- raise an allocation, remove its own reduction to increase traffic, or promote a stage;
- override an operator, fleet, provider, platform, or region deny;
- bypass a circuit, concurrency permit, route budget, terminal error, or delivery validation.

Recovery evidence does not automatically increase traffic. It marks the guard eligible for operator
review. An operator may then clear or replace it using optimistic concurrency, after which the
effective allocation is still capped by the current operator grant and qualification stage.

This separation prevents an evaluator from overwriting the human authorization record and makes
every reduction, denial, and recovery review independently attributable.

### 7. Persist guard decisions and audit them without private evidence

PostgreSQL is the durable source for automatic guard policy, current guard state, and append-only
actions. Redis may distribute a compiled expiring snapshot but cannot become the source of truth.
The later implementation owns schemas equivalent to:

- pilot policy: opaque ID, version, tuple scope, windows, sample requirements, thresholds, evidence
  age, cooldown, activation/expiry, and review metadata;
- current guard: tuple, policy version, cap in basis points, reason code, evidence-window bounds,
  revision, updated time, and expiry;
- guard audit: previous/new cap, action (`hold`, `reduce`, `deny`, `eligible_for_review`), reason code,
  policy version, evidence-window bounds, sanitized sample summary, actor type/ID, and timestamp;
- qualification review: provider/platform/region, stage, pause state/reason, approval reference,
  reviewed policy versions, opaque reviewer/owner IDs, revision, and review timestamps.

Free-form evidence, URLs, task or candidate identifiers, media metadata, network addresses, provider
payloads, headers, cookies, tickets, and secrets are prohibited. Reason codes are a bounded enum;
operator notes remain concise, sanitized metadata under the ADR-0007 restrictions.

Writes use optimistic concurrency. Publication refuses older global revisions. A guard snapshot has
a bounded TTL; missing or stale guard state fails safe for active public traffic according to the
locked policy and cannot be interpreted as an unrestricted cap.

### 8. Fix precedence and promotion authority

For a provider attempt, the effective deny/permission order is:

1. public request, rights, host recognition, and admission checks;
2. deployment enablement and current production/commercial approval;
3. static manifest provider/platform/region capability and production mock refusal;
4. current qualification stage and pause state;
5. operator/fleet/provider/platform/region denies;
6. affirmative operator rollout grant;
7. automatic guard cap or deny;
8. exact-tuple circuit and half-open probe permission;
9. concurrency, ranking, sequential fallback, and route budgets;
10. normalized result, candidate, and delivery policy validation.

No later gate overrides an earlier denial. Static provider priority remains dominant among routes
that survive every gate.

Only a reviewed operator action can advance `internal → limited → stable` or increase allocation.
Promotions proceed one stage at a time. Each action records the current approval reference, policy
version, fresh evidence window, sample sufficiency, prior allocation, requested allocation, actor,
and reason. Optimistic concurrency prevents a stale reviewer from overwriting a pause or newer
guard.

The planned X rollout uses internal, 5%, 25%, 50%, and 100% checkpoints. These percentages are
operator checkpoints, not adapter constants. Each promotion waits for its locked observation window;
no calendar deadline forces advancement. Seven consecutive daily healthy evidence reviews across a
minimum seven-day external observation window are required before work item 10 closes.

### 9. Keep operational controls outside the public product

Qualification, evidence, guard state, provider identity, fallback depth, circuit state, approval,
and rollout percentage remain absent from public OpenAPI, SEO pages, task results, and Web copy.
Protected diagnostics may expose only sanitized tuple, stage, policy/revision, sample sufficiency,
aggregate measures, guard cap/reason, and freshness. It keeps the independent credential,
`no-store`, and `noindex` boundaries established in work items 8 and 9.

The consumer experience uses only generic recognized, queued, resolving, ready, retryable failure,
and terminal failure states. A Product Design audit of real primary-success, fallback-success,
failure, delivery, and expiry journeys is a blocking qualification gate, but it cannot expose the
control plane to explain delays.

## Invariants

1. Provider health and canary success never grant production permission.
2. Operator rollout grants are the only controls that can raise traffic; automation can only hold,
   reduce, or deny.
3. Operator and emergency denies always win over grants, guards, health, and recovery evidence.
4. Qualification, rollout, circuit health, delivery policy, and catalog status remain independent
   gates.
5. Every production format has exactly one valid internal candidate under a reviewed host policy.
6. Missing or insufficient evidence never counts as a healthy promotion window.
7. Queue retries and high-frequency canaries cannot manufacture distinct user-route sample size.
8. Terminal content, authorization, payment, DRM, and policy outcomes cannot be bypassed by fallback.
9. Production mocks, challenge solving, user cookies, and unbounded host policies are forbidden.
10. Pilot evidence and audits contain no submitted URL, media metadata, provider payload, direct
    link, credential, ticket, caller identity, or raw error text.
11. Every stage, promotion, reduction, deny, and recovery review is attributable to a policy version,
    evidence window, revision, and sanitized actor.
12. Work item 10 cannot close on deterministic CI alone; it also requires reviewed external canary
    and staged-rollout evidence.

## Rejected alternatives

### Treat a closed circuit as production qualification

Rejected because circuit health measures recent technical behavior, not terms approval, candidate
coverage, delivery safety, product readiness, or operator intent.

### Let the rollout evaluator edit operator rules directly

Rejected because automation could erase provenance, race an emergency action, or accidentally
restore traffic. A separate restrictive guard keeps permission and rollback authority distinct.

### Allow automatic recovery to restore the previous grant

Rejected because clearing a guard increases effective traffic. Recovery marks the route eligible
for operator review; it does not promote or restore automatically.

### Set numeric SLOs before internal evidence exists

Rejected because unmeasured thresholds create false precision. TikDD calibrates three complete
internal days, then locks a reviewed versioned policy before limited traffic.

### Count canaries and queue retries as ordinary user samples

Rejected because they can overwhelm sparse user-route evidence and manufacture apparent health.
They remain separately labeled evidence sources.

### Store URLs or media facts to make incidents easier to debug

Rejected because source URLs and media metadata are untrusted, potentially identifying, and not
needed for qualification decisions. Debugging uses bounded normalized classes and separately
authorized live reproduction.

### Promote DLPanda because an adapter already exists

Rejected because current X delivery candidate coverage and regional challenge behavior are not
qualified. Existing code reduces implementation cost but does not waive evidence or approval gates.

## Consequences

- Work item 10.1 must qualify DLPanda or another authorized provider without presuming the winner.
- Work item 10.2 must make the selected adapter production-complete under ADR-0005.
- Later work adds durable pilot policy, qualification, sanitized delivery-outcome, guard, and audit
  persistence plus expiring Redis distribution.
- Operators retain exclusive promotion authority and must review recovery before increasing traffic.
- Sparse traffic may extend the pilot because insufficient evidence safely holds the current stage.
- Public contracts and the selected Web design require no control-plane fields for this ADR.
- TikTok, YouTube, yt-dlp, proxy delivery, temporary objects, and indexable platform pages remain
  outside work item 10.

## Implementation and verification order

1. Work item 10.1 records provider qualification evidence and selects the second X provider.
2. Work item 10.2 completes its manifest, fixtures, normalized candidates, host policy, delivery,
   and production-approval prerequisites.
3. Work item 10.3 proves two-real-provider sequential fallback, terminal stops, route budgets, and
   the authorized X corpus without a production mock.
4. Work item 10.4 audits the real bilingual desktop/mobile journey and closes every P0 finding.
5. Work item 10.5 implements versioned pilot policy, sanitized delivery outcomes, restrictive guard
   state/audit, protected diagnostics, three-day calibration, and staged operator promotion.
6. Work item 10.6 composes deterministic Docker/CI verification and links the separate seven-day
   authorized operational evidence before aggregate closure.

Every implementation item runs `pnpm check`. Persistence changes require migrations, cleanup,
repository tests, and Docker verification. Provider changes require sanitized fixtures, typed
error-decision tests, routing contract tests, and reviewed host policies. No pull-request CI calls a
live provider.
