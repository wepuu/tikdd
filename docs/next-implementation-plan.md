# TikDD next implementation plan

> Historical roadmap. ADR-0020 and `docs/development-plan.md` now define the X Beta release loop;
> elapsed calibration windows and the former client acknowledgement are no longer launch gates.

> Historical record: this plan captured the pre-rebaseline execution sequence through Work Items
> 11 and 12. It is preserved for traceability and must not be used as the current delivery order.
> The authoritative future sequence begins with Work Item 14 in the
> [rebaselined development roadmap](development-plan.md), based on
> [the current-state audit](project/current-state-audit.md).

> Owner control-plane continuation: work items 12.7 through 12.9.1 are complete. The next implementation
> slice is work item 12.10 (bounded settings and recovery tools), followed by the integrated work
> item 12 gate in 12.11. See
> [the work item 12 plan](work-item-12-implementation-plan.md).

> Current continuation: [Work item 11 implementation plan](work-item-11-implementation-plan.md).
> The verified local X download now shifts the next priority to reproducible pilot operation,
> actual-journey Product Design QA, and privacy-safe evidence automation. Work items 11.1–11.4 are
> complete; the consolidated work item 11 engineering gate is ready. Deployment `tikdd` in region
> `nl` behind Cloudflare/Nginx is selected and Provider use is confirmed; live runtime signals and
> real 11.6 elapsed calibration remain operationally pending.

## Product decision

The next objective is a narrow, production-shaped X download pilot, not broader catalog marketing.
TikDD should first prove that one authorized public X URL can move safely through recognition,
provider routing, normalized results, format selection, and controlled delivery. Provider redundancy,
TikTok rollout, yt-dlp, and indexable platform pages follow only after that vertical slice is healthy.

This order turns the current resolver demo into a usable product while preserving the system
boundaries needed for future adapters.

## Current baseline

- The Web, API, Redis queue, worker, PostgreSQL, and delivery service are separate applications.
- The catalog recognizes 22 platform families without claiming that all are production-supported.
- TwitterSaver resolves the authorized X canary and returned four normalized formats on 2026-08-04.
- DLPanda reaches `provider_challenge` from the current region; the router records the failure and
  successfully moves to the next eligible provider.
- Public results deliberately omit upstream media URLs. TwitterSaver now maps its formats to
  encrypted internal candidates, and the delivery service issues one-use redirect tickets guarded
  by an exact host policy and public-DNS validation.
- The Web flow submits and polls tasks, exposes only normalized format choices, and requests
  controlled delivery without naming providers. English and Simplified Chinese cover the current
  validation, progress, failure, result, and delivery states.
- `pnpm dev` now supervises one reproducible Mock-only local stack; `pnpm dev:pilot` fails closed
  without current-shell authorization, exact providers, approvals, ephemeral delivery material,
  and page-host egress; `pnpm dev:stop` leaves PostgreSQL and Redis data intact.
- A newly authorized real X journey now has desktop and 360-pixel Product Design evidence through
  resolution, controlled delivery, natural expiry, regeneration, and a redeemed one-use browser
  handoff. English and Simplified Chinese handoff feedback is explicit and all audited P0/P1 issues
  are closed; live fallback remains a named evidence limit because the primary route succeeded.
- [ADR-0009](architecture/adr/0009-pilot-evidence-and-delivery-outcomes.md) is implemented by the
  exact tuple/class evidence store, distinct-task UTC aggregation, sanitized delivery outcomes,
  deterministic replay/retention, and scheduled restrictive evaluator. It grants no traffic;
  work item 11.5 must establish the internal deployment preflight before any pilot authorization.

## Target user journey

1. The user pastes an authorized public page URL.
2. TikDD recognizes the platform locally and explains whether it is available in the user's region.
3. The user starts an asynchronous task.
4. The page shows useful queued and resolving states without revealing provider implementation
   details.
5. On success, the user sees understandable format choices and requests one download.
6. TikDD creates a short-lived delivery ticket and redirects only to a validated provider-owned
   media host.
7. On failure, the page gives an actionable, localized explanation and a safe retry path.

Task pages, result payloads, delivery tickets, and source URLs remain non-indexable.

## Delivery sequence

### Phase 1 — Safe X vertical slice

Estimated effort: 5–7 engineering days.

1. Write an ADR for the internal delivery-candidate boundary.
2. Add an internal provider-resolution model containing:
   - the existing public `ResolveResult`;
   - delivery candidates keyed by TikDD format ID;
   - provider ID, delivery mode eligibility, expiry, and an explicit media-host policy;
   - optional upstream headers as server-only encrypted data, never as public contract fields.
3. Add a `delivery_candidates` migration with task/format uniqueness, hard expiry, encrypted secret
   fields, and cascade deletion with the task.
4. Persist the normalized result and its candidates in one transaction after a successful route.
5. Upgrade TwitterSaver to produce generic internal candidates while continuing to discard raw
   provider payloads.
6. Implement redirect-only delivery tickets with signed, single-purpose, short-lived tokens.
7. Validate HTTPS, provider-specific host allowlists, every redirect hop, resolved IP ranges, task
   ownership scope, candidate expiry, and format identity before redirecting.
8. Keep byte-range proxying, account cookies, merge/transcode, and temporary files out of this phase.

Exit gate:

- The authorized X canary completes from API submission to a working short-lived redirect.
- No upstream URL, cookie, secret header, or raw provider payload appears in the Web/API response,
  logs, provider-attempt ledger, or public task record.
- SSRF, redirect escape, token tampering, token expiry, and duplicate-delivery tests pass.
- If TwitterSaver requires server-held cookies or headers for delivery, the pilot stops at format
  resolution rather than silently expanding into proxy delivery.

### Phase 2 — Product flow and multilingual result experience

Estimated effort: 4–6 design and engineering days.

Product Design gate:

- Use [`design/homepage.png`](design/homepage.png) as the primary direction reference and follow the
  constraints recorded in [`design/README.md`](design/README.md).
- Generate exactly three visual directions for the existing landing/resolver experience.
- Review all three directions with the `frontend-design` skill before presenting them for selection.
- Keep the current responsive Web product, brand name, blue signal color, and engineering-oriented
  clarity as constraints unless the project owner changes them.
- Select one direction before changing the production UI, then compare desktop and mobile renders
  against the chosen target during design QA.

Implementation scope:

1. Replace the technical signal rail with a plain-language progress sequence: recognized, queued,
   resolving, ready, and unable to resolve.
2. Remove provider identity and internal warnings from the consumer result panel.
3. Present formats using user-relevant labels: quality, video/audio composition, container, and size
   only when reliably known.
4. Connect the format action to delivery-ticket creation and handle expired-link regeneration.
5. Localize every validation, timeout, failure, and delivery state in English and Simplified Chinese.
6. Correct corrupted separator/copyright glyphs and prevent locale fallback to hard-coded English.
7. Preserve keyboard flow, visible focus, live-region announcements, reduced motion, 44-pixel touch
   targets, and mobile layouts at 360 px.
8. Add analytics events only for anonymous funnel states; never include submitted URLs or media
   metadata.

Exit gate:

- A first-time user can complete the authorized X journey on desktop and mobile without learning
  what a provider or adapter is.
- English and Simplified Chinese have equivalent states and no mojibake.
- Automated accessibility checks pass, and screenshot QA covers empty, resolving, success, terminal
  error, retryable error, and expired-delivery states.

### Work item 7.1 — P0 task-flow audit closure

Status: complete on 2026-08-07.

The post-implementation flow audit found that visual fidelity was acceptable but the successful task
journey still competed with educational content. This closure keeps the selected visual direction
while making task state the dominant product structure.

Implemented scope:

1. Keep recognized-link feedback directly beneath the resolver on desktop and mobile.
2. Reset task feedback when the submitted URL changes.
3. Move focus and the viewport to the result card when resolution succeeds, with reduced-motion
   behavior preserved.
4. Put the active result before feature and process education on mobile and hide those educational
   cards while a task is resolving or ready.
5. Replace development/provider-flavored mock titles with localized consumer copy.
6. Show normalized author, duration, platform, and format-count metadata when available.
7. Use a neutral platform result preview until an approved thumbnail-delivery boundary exists;
   never load arbitrary upstream thumbnail URLs in the browser.

Exit gate:

- A recognized link explains exactly why Resolve is disabled.
- A successful desktop or mobile task announces and focuses the result without exposing provider
  identity or showing an unrelated example image as real media.
- English and Simplified Chinese preserve equivalent task order, copy, focus, and reduced-motion
  behavior.

### Phase 3 — Reliability control plane

Estimated effort: 5–7 engineering days.

#### Work item 8.0 — Health state and circuit-breaker ADR

Status: complete on 2026-08-07.

[ADR-0006](architecture/adr/0006-provider-health-and-circuits.md) fixes the circuit key as provider,
platform, and actual worker region; keeps PostgreSQL attempts as durable sanitized observations; and
uses Redis only for expiring snapshots and atomic half-open probe leases. It also defines failure
classification, distinct-task sampling, hysteresis, stale-state degradation, and metadata-only
diagnostic boundaries before persistence or provider-selection code changes.

#### Work item 8.1 — Attempt region and tuple health contract

Status: complete on 2026-08-07.

Provider attempts now require a validated concrete worker region, while provider manifests may use
either concrete region slugs or `"*"` for eligibility. The health-source contract receives provider,
platform, and region together. Migration `0004` backfills existing attempts to `global`, enforces the
region constraint, and adds the tuple health index. Contract, router, persistence, migration-shape,
and Docker-backed PostgreSQL verification cover the boundary.

#### Work items 8.2–8.5 — Aggregation, distributed circuits, routing, and diagnostics

Status: complete on 2026-08-09.

- `@tikdd/routing-health` implements runtime policy validation, distinct-task sampling, categorized
  failures, p95 latency, minimum samples, hysteresis, recovery counts, and bounded cooldown growth.
- Redis state is expiring and revisioned. Compare-and-set publication protects concurrent state, and
  one atomic lease gates half-open probes.
- The worker health loop is disabled by default, requires explicit policy JSON, and uses a
  distributed aggregation lease. Missing Redis health state degrades to neutral static routing.
- The Provider Router consumes exact provider/platform/region state. A development-only
  failure-injection adapter verifies fallback and attempt-budget behavior.
- `/internal/v1/provider-health` is absent unless an independent 32-character bearer secret is
  configured. It returns only sanitized metadata and is intentionally excluded from public OpenAPI
  and the consumer Web application.
- `pnpm verify:routing-health` provides a cleanup-safe PostgreSQL/Redis transition verification.

#### Work item 8.6 — Docker transition verification closure

Status: complete on 2026-08-09.

Windows/Hyper-V reserved the TCP range containing both `6379` and `6380`, which prevented Docker
Desktop from publishing Redis even though neither port had a listening process. Local Compose now
publishes container port `6379` through configurable host port `REDIS_HOST_PORT`, defaulting to
`16379`; API and worker local defaults use the matching URL.

The Docker-backed verification applied migrations `0001`–`0004` and proved PostgreSQL observation
reads, publication to Redis `open`, a single atomic half-open probe lease, and recovery to `closed`.
Its temporary PostgreSQL rows and Redis keys were removed, both containers remained healthy, and
the final `pnpm check` passed with 69 tests.

#### Work item 9.0 — Runtime rollout and abuse-control ADR

Status: complete on 2026-08-09.

[ADR-0007](architecture/adr/0007-rollout-admission-and-abuse-controls.md) separates explicit
production permission from inferred circuit health. It defines deny-first provider/platform/region
rollout rules, deterministic URL-free task cohorts, an auditable PostgreSQL source with expiring
Redis distribution, capability-safe idempotency and duplicate suppression, trusted-proxy-derived
anonymous quotas, distributed concurrency permits, bounded cleanup, and generic public errors.
All ADR-0007 runtime behavior and its integrated verification gate are complete.

#### Work item 9.1 — Runtime rollout rules and emergency deny

Status: complete on 2026-08-09.

`@tikdd/rollout-control` validates unambiguous rules, applies deny-first matching, assigns stable
URL-free task cohorts, rejects production mocks, publishes revisioned expiring Redis snapshots, and
fails closed on stale authorization. Migration `0005` stores current rules and append-only operator
audit. The worker evaluates rollout before circuit health and refreshes PostgreSQL state within five
seconds. `pnpm rollout:apply` is the narrow direct operator path; `pnpm verify:rollout-control`
proves a Docker-backed allow-to-emergency-deny transition and cleanup.

#### Work item 9.2 — Task idempotency and canonical duplicate admission

Status: complete on 2026-08-09.

The control API accepts a bounded optional `Idempotency-Key`, stores only domain-separated keyed
digests, and transactionally creates or replays one task. Migration `0006` adds task-bound
idempotency and active-source records. Concurrent same-key requests produce one task and queue
winner; conflicting reuse returns generic `409`; another caller submitting an active canonical
source receives only `429` plus `Retry-After`. Terminal tasks release the source lock, while the
idempotency record remains replayable until task expiry. OpenAPI, contracts, bilingual Web errors,
Docker verification, and operations documentation cover the boundary.

#### Work item 9.3 — Trusted proxy quotas and distributed concurrency

Status: complete on 2026-08-09.

`@tikdd/admission-control` validates versioned deployment/region policy, resolves client addresses
only through exact trusted proxy CIDRs, and uses domain-separated HMAC identities. Redis Lua applies
client/global rate and active-task limits atomically and retains task permits across queue retries.
The worker owns terminal release and exact provider/platform/region owner leases. Busy providers
fall through without consuming the attempt budget or a half-open probe. Public contracts, OpenAPI,
bilingual Web errors, spoofing tests, fail-closed tests, and Docker Redis verification cover the
boundary.

#### Work item 9.4 — Singleton bounded cleanup and retention

Status: complete on 2026-08-09.

`@tikdd/cleanup` runs independently from Web, API, resolver workers, and delivery. A
deployment-scoped Redis owner lease admits one scheduled run; PostgreSQL stages use stable ordering,
`FOR UPDATE SKIP LOCKED`, and separate batch transactions. Dry-run and execution report sanitized
counts, duration, errors, and stop reason. Migration `0007` supplies cleanup indexes, while
`pnpm verify:cleanup` proves singleton contention, no-write counting, cascade deletion, fresh-row
preservation, and zero-change repetition against Docker services.

#### Work item 9.5 — Authorized canaries and protected operational diagnostics

Status: complete on 2026-08-09.

`@tikdd/canary` is an independently scheduled, Redis-singleton probe that requires explicit owner
authorization, canary-region rollout permission, circuit evaluation, distributed concurrency, and
sequential routing. Migration `0008` persists only expiring normalized measurements. The protected
diagnostics route now reports priority, rollout revision, circuit state, recent categorized failures,
fallback depth, and canary health without exposing URLs, media, candidates, secrets, or caller data.
`pnpm verify:canary` proves persistence, lease ownership, aggregation, and cleanup on Docker.

#### Work item 9.6 — Integrated Docker failure matrix and work item 9 closure

Status: complete on 2026-08-09.

`pnpm verify:work-item-9` composes migrations, rollout kill-switch/stale-state denial, concurrent
idempotency and duplicate suppression, Redis quota/concurrency limits, circuit failure/recovery,
bounded cleanup, canary retention, and the full repository quality gate. All eight stages passed
locally against Docker PostgreSQL/Redis, including 27 test files and 106 tests. GitHub CI now runs
the identical service-backed gate. Aggregate work item 9 is complete.

1. Aggregate attempt-ledger windows by provider, platform, and region.
2. Add circuit states with minimum sample sizes, separate failure-class thresholds, hysteresis, and
   automatic half-open probes.
3. Runtime provider/platform/region/percentage rules and an immediate deny switch are complete.
4. Scheduled authorized canaries persist only sanitized status, latency, format count, failure
   class, and link-lifetime measurements.
5. The protected read-only diagnostics endpoint reports priority, circuit state, recent sanitized
   failures, fallback depth, and canary health.
6. Task idempotency, canonical-URL deduplication, anonymous quotas, concurrency limits, and bounded
   expiry cleanup are complete before exposing the pilot to public traffic.

Exit gate:

- A forced TwitterSaver failure opens only the X/current-region circuit and does not affect other
  platform capabilities.
- A healthy half-open probe closes the circuit; a challenge or schema change triggers fallback
  without queue retry amplification.
- Operators can disable the route without deploying Web or API.

### Phase 4 — Real redundancy and controlled rollout

Detailed execution and acceptance criteria are recorded in
[Work item 10 implementation plan](work-item-10-implementation-plan.md).

Estimated effort: 9–15 engineering days plus a seven-day observation window.

#### Work item 10.0 — Provider qualification and pilot-control ADR

Status: complete on 2026-08-10.

[ADR-0008](architecture/adr/0008-provider-qualification-and-pilot-controls.md) defines the
qualification lifecycle from candidate through stable or paused, keeps technical-test authorization
separate from production approval, and requires three complete internal calibration days before
numeric pilot SLOs are locked. Operators alone may grant or increase traffic. Automatic evaluation
uses a separate revisioned guard that can only hold, reduce, or deny an existing grant, and every
decision is tied to sanitized evidence, a policy version, and an audit revision.

1. ADR-0008 fixes provider qualification, evidence, SLO calibration, promotion, rollback, and
   operator authority before production provider-selection changes. Complete.
2. Qualify DLPanda as the first candidate for the second X route, but select another explicitly
   authorized provider if its regional challenge or delivery boundary cannot pass safely.
3. Complete the selected adapter with normalized formats, reviewed delivery candidates, exact host
   policies, fixtures, canaries, and a kill switch.
4. Prove deterministic two-provider fallback across an expanded authorized X corpus; the development
   mock must not participate in staging or production success paths.
5. Audit the real desktop and mobile user journey for primary success, fallback success, terminal
   failure, retryable failure, delivery, and expiry before public traffic.
6. Calibrate three days of internal evidence, then roll out by region and percentage: internal only,
   5%, 25%, 50%, then 100%, with bounded automatic rollback.
7. Close the phase with one deterministic Docker/CI gate plus a separate seven-day authorized canary
   evidence record.

Work item 10.1 is currently in progress. Exact canary-ID selection is implemented, and the project
owner authorized one DLPanda/X request on 2026-08-10. It returned `provider_challenge` after 1,467 ms
without media requests or bypass attempts, so DLPanda remains `fixture-ready` and is paused for X in
the current `global` region. Its one-time tuple was removed after the run. Closing 10.1 now requires
another explicitly authorized X provider, or a separately reviewed and authorized DLPanda region.
SSSTwitter is now the authorized replacement candidate. Its first response exposed a page-scope
parser defect, so that result is excluded from qualification evidence. The parser now requires the
complete `#result` subtree. An explicitly approved repeat succeeded in 4,931 ms with two normalized
formats and only `ssscdn.io` as sanitized host evidence. SSSTwitter is selected at `canary-ready`;
the consumed tuple was removed, and delivery validation moves to work item 10.2.

Exit gate:

- Two real X providers demonstrate deterministic fallback and seven consecutive healthy canary runs.
- Success rate, p95 latency, fallback depth, delivery failures, and provider challenge rate meet the
  pilot SLO.
- P0 product-flow findings are closed in English and Simplified Chinese on desktop and mobile.
- The mock provider is disabled outside development.

## Deferred until after the pilot

- Byte-range proxying and temporary object storage.
- User-supplied platform cookies or credentials.
- FFmpeg merge/transcode and progress events.
- Isolated yt-dlp runner image.
- Indexable TikTok, YouTube, or X SEO pages.
- More locales, advertising, and broad analytics.

These are valuable, but each would expand security, operational, or content-quality risk before the
core product loop is proven.

## Work-item order for Codex

| Order | Work item | Depends on | Required verification |
| --- | --- | --- | --- |
| 1 | ADR: internal delivery candidates — complete | Current architecture | ADR review against security boundaries |
| 2 | Candidate contract and migration — complete | ADR | Contract and migration tests |
| 3 | Transactional worker persistence — complete | Candidate storage | Rollback and expiry integration tests |
| 4 | TwitterSaver candidate mapping — complete | Internal contract | Sanitized fixtures and live canary |
| 5 | Signed redirect delivery — complete | Candidate mapping | SSRF, redirect, DNS, expiry, tamper tests |
| 6 | Three Product Design directions — complete; option 1 selected | Working vertical slice | Selection recorded in `docs/design/selection-record.md` |
| 7 | Selected multilingual flow — complete | Selected direction | Desktop/mobile visual QA passed |
| 7.1 | P0 task-flow audit closure — complete | Flow audit after work item 7 | Resolver/result desktop and mobile interaction QA |
| 8.0 | Health state and circuit-breaker ADR — complete | Attempt ledger and ADR-0004 | ADR review against routing, persistence, and privacy boundaries |
| 8.1 | Attempt region and tuple health contract — complete | ADR-0006 | Contract, migration, persistence, and Docker PostgreSQL verification |
| 8 | Health aggregation and circuits — complete | Attempt ledger | Failure-injection, hysteresis, Redis lease, diagnostics, and Docker state-transition tests |
| 9.0 | Runtime rollout and abuse-control ADR — complete | Work item 8 | ADR review against routing, persistence, privacy, and delivery boundaries |
| 9.1 | Runtime rollout rules and emergency deny — complete | ADR-0007 | Rule validation, deny precedence, revision rollback, production mock, and Docker transition tests |
| 9.2 | Task idempotency and canonical duplicate admission — complete | ADR-0007 | Contract/OpenAPI parity, HMAC separation, concurrent replay/conflict, capability isolation, and Docker tests |
| 9.3 | Trusted proxy quotas and distributed concurrency — complete | ADR-0007 | Spoofing, atomic rate/active limits, owner leases, fail-closed Redis, fallback, and Docker tests |
| 9.4 | Singleton bounded cleanup — complete | ADR-0007 and task expiry | Dry-run, lease contention, cascade, repeat, and Docker tests |
| 9.5 | Authorized canaries and diagnostics — complete | Work items 8 and 9.1–9.4 | Privacy tests, singleton lease, diagnostics, and Docker persistence/cleanup |
| 9.6 | Integrated Docker failure matrix — complete | Work items 9.1–9.5 | Eight-stage gate plus full `pnpm check` |
| 9 | Flags, quotas, dedupe, cleanup — complete | Health state | Docker-backed end-to-end gate passed |
| 10.0 | Provider qualification and pilot-control ADR — complete | Work item 9 | ADR review of approval, SLO, rollback, audit, and privacy boundaries |
| 10.1 | Second X provider qualification — complete | ADR-0008 and authorized replacement | SSSTwitter selected after sanitized regional canary and reviewed provider record |
| 10.2 | Production-complete second adapter — complete | Selected provider evidence | Candidate parity, exact host policy, request security, activation gates, typed errors, and four-minute proxy-path lifetime evidence pass |
| 10.3 | Two-provider routing and X corpus — complete | Two deliverable adapters | Real-adapter deterministic fallback, terminal-stop, circuit, concurrency, corpus, ticket, and public-projection tests pass |
| 10.4 | Real-journey Product Design audit — complete | Two-provider application states | Desktop/mobile bilingual P0 closure and screenshot QA passed |
| 10.5 | Control plane complete; operational observation pending | Independent production/commercial approval | Three-day calibration and seven-day evidence remain real-time gates |
| 10.6 | Deterministic gate implemented; external closure pending | Production approval and real-time observation | `pnpm verify:work-item-10` plus seven-day evidence |
| 10 | Second real X adapter and controlled pilot | Canary framework | Two real providers and reviewed staged-rollout evidence |
| 11.0 | Work item 10 baseline — complete | Verified work item 10 | Git baseline and remote push |
| 11.1 | Reproducible local Pilot launcher — complete | 11.0 | Fail-closed startup, bounded stop, and retention checks |
| 11.2 | Authorized real-journey audit — complete | 11.1 | Bilingual desktop/mobile P0/P1 closure |
| 11.3 | Pilot evidence and delivery-outcome ADR — complete | ADR-0008 and 10.5 | ADR-0009 privacy, aggregation, retention, and evaluator review |
| 11.4 | Evidence aggregator and restrictive evaluator — complete | 11.3 | Migration, replay, cleanup, privacy, stale-state, and Docker tests pass |
| 11.5 | Internal deployment preflight — implementation complete, settings pending | 11.4 and deployment decisions | Fail-closed control passes; deployment ID, region, proxy mode, Provider use, and real signals remain |
| 11.6 | Consolidated engineering gate — complete; observation pending | 11.5 | Offline CI baseline passes; real three-day calibration and seven-day observation cannot be simulated |

Every work item ends with `pnpm check`. Boundary changes also update OpenAPI, contracts, migrations,
security documentation, and the relevant ADR in the same change.

## Pilot success metrics

- Resolution success rate by provider/platform/region.
- Delivery-ticket creation and redirect success rate.
- p50/p95 time to formats and time to delivery.
- Average and p95 fallback depth.
- Challenge, timeout, schema-change, unsupported-URL, and terminal-policy rates.
- User funnel: recognized → submitted → formats ready → delivery requested.
- Zero submitted URLs, media metadata, direct links, cookies, or secrets in analytics and logs.

Initial target values should be set after the first three days of internal pilot traffic rather than
invented before real measurements exist. Security and privacy gates are absolute, not statistical.
