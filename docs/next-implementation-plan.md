# TikDD next implementation plan

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

## Target user journey

1. The user pastes an authorized public page URL.
2. TikDD recognizes the platform locally and explains whether it is available in the user's region.
3. The user confirms download rights and starts an asynchronous task.
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

1. Keep one rights confirmation directly beneath the resolver on desktop and mobile, and show the
   disabled-action reason beside it.
2. Reset rights confirmation when the submitted URL changes.
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
The remaining runtime behavior is scheduled for work items 9.3–9.6.

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

1. Aggregate attempt-ledger windows by provider, platform, and region.
2. Add circuit states with minimum sample sizes, separate failure-class thresholds, hysteresis, and
   automatic half-open probes.
3. Runtime provider/platform/region/percentage rules and an immediate deny switch are complete.
4. Schedule authorized canaries and persist only sanitized measurements: status, latency, format
   count, failure class, and link lifetime.
5. Add a protected read-only diagnostics endpoint for priority, circuit state, recent sanitized
   failures, fallback depth, and canary health.
6. Task idempotency and canonical-URL deduplication are complete; add per-IP quotas, concurrency
   limits, and expiry cleanup before exposing the pilot to public traffic.

Exit gate:

- A forced TwitterSaver failure opens only the X/current-region circuit and does not affect other
  platform capabilities.
- A healthy half-open probe closes the circuit; a challenge or schema change triggers fallback
  without queue retry amplification.
- Operators can disable the route without deploying Web or API.

### Phase 4 — Real redundancy and controlled rollout

Estimated effort: 5–10 engineering days plus a seven-day observation window.

1. Add a second authorized X-capable adapter using the provider template, fixture suite, canary gate,
   allowlists, and kill switch.
2. Expand the authorized corpus to URL variants such as short links, quoted posts, multi-video posts,
   image-only posts, deleted content, private content, and region-restricted content.
3. Run both real providers through sequential fallback; the development mock must not participate in
   staging or production success paths.
4. Roll out by region and percentage: internal only, 5%, 25%, 50%, then 100%, with automatic rollback
   on error-rate or latency thresholds.
5. Begin TikTok only after selecting a second real adapter for regions where DLPanda presents a
   challenge. YouTube follows the same gate rather than being advertised from catalog recognition
   alone.

Exit gate:

- Two real X providers demonstrate deterministic fallback and seven consecutive healthy canary runs.
- Success rate, p95 latency, fallback depth, delivery failures, and provider challenge rate meet the
  pilot SLO.
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
| 9 | Flags, quotas, dedupe, cleanup | Health state | Docker-backed end-to-end tests |
| 10 | Second real X adapter | Canary framework | Seven-day staged rollout evidence |

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
