# Work item 11 implementation plan

## Outcome

Work item 11 turns the verified local X download journey into a repeatable internal-pilot operating
system. It does not broaden platform claims. The target is that an authorized operator can start
one clean local or internal environment, observe the complete privacy-safe journey, collect
attributable aggregate evidence, and stop or roll back traffic without editing Web/API code.

The user-confirmed successful X download on 2026-08-10 is useful product evidence: recognition,
resolution, format selection, ticket creation, redirect delivery, and browser download can complete
as one journey. It is not production approval, an SLO baseline, or seven-day pilot evidence.

## Product decision

Keep the current Signal Runway visual direction and consumer state model. Do not redesign the
landing page or expose provider operations. The next product-design pass audits the actual success
journey and fixes only evidence-backed friction in progress, format selection, download preparation,
browser handoff, expiry, regeneration, and failure recovery.

Do not begin TikTok, YouTube, yt-dlp, proxy delivery, indexable platform pages, or broader marketing
claims until the X pilot reaches the reviewed closure gate.

## Current baseline

- `pnpm verify:work-item-10` passes all 12 deterministic Docker/CI stages without live provider
  requests and leaves no verification records or Redis keys.
- TwitterSaver and SSSTwitter complete real local X resolution and controlled redirect delivery.
- Real providers remain disabled by default and production/commercial approval is not established.
- The public API and Web experience expose generic task states and TikDD formats, never provider
  identity, upstream URLs, fallback depth, circuits, rollout allocation, or guard state.
- The local test exposed a developer-experience gap: the root `pnpm dev` filter is not reliable on
  Windows, stale child processes can survive parent termination, and a sandboxed Worker can look
  healthy while lacking provider egress.
- Pilot guard persistence and deterministic evaluation exist, but the real evidence aggregation,
  scheduled evaluator, delivery-outcome source, and daily review workflow are not yet a complete
  internal-pilot service.

## Delivery sequence

### Work item 11.0 — Freeze the work item 10 baseline

1. Review the complete work item 10 diff and exclude generated caches, runtime logs, temporary
   keys, downloaded media, and local environment files.
2. Run `pnpm verify:work-item-10` from the intended baseline.
3. Commit the ADR, provider records, adapter, delivery boundary, Product Design audit, pilot guard,
   evidence contract, and integrated gate as one reviewed baseline.
4. Push `main` through the configured local proxy and confirm CI runs `verify:work-item-10`.

Exit gate:

- the repository is reproducible from a clean checkout;
- CI passes without live provider access;
- no credentials, submitted URLs, media, raw responses, or runtime artifacts enter Git.

Expected effort: 0.5 day.

### Work item 11.1 — Cross-platform local pilot launcher

Replace the fragile manual startup sequence with explicit, fail-fast commands.

1. Fix the root development command so Windows, Linux, and CI resolve the same explicit Web, API,
   Worker, and Delivery package set.
2. Add a default offline `pnpm dev` profile using only the development mock.
3. Add a separate `pnpm dev:pilot` profile that requires an explicit local-live authorization flag,
   exact enabled providers, reviewed approval flags, and ephemeral delivery encryption material.
4. Validate Docker health, migrations, ports 3000/4000/4002, duplicate process trees, Web route
   readiness, API/Delivery readiness, Worker queue consumption, provider page-host egress, and
   provider defaults before reporting ready.
5. Add a bounded `pnpm dev:stop` command that terminates only processes recorded by the launcher;
   never discover or kill unrelated Node processes by name.
6. Keep proxy configuration deployment-owned and explicit. A launcher may verify configured egress,
   but must not silently inherit or invent a proxy.

Exit gate:

- one command starts exactly one complete stack and returns the correct local URL;
- a second start fails clearly instead of moving Next.js to another port;
- stopping removes owned processes and leaves PostgreSQL/Redis data intact;
- missing provider egress is reported before the user submits a URL;
- real adapters still cannot start without explicit technical-test authorization.

Expected effort: 1–2 days.

### Work item 11.2 — Actual-success Product Design audit

Audit the implemented journey using a newly authorized real X test, not fixture-only UI states.

1. Capture desktop and 360-pixel mobile states for recognized, resolving, slower fallback,
   formats-ready, preparing download, short-lived link ready, browser handoff, expired link, and
   regeneration.
2. Compare the real captures with the selected Signal Runway reference and the work item 10.4
   deterministic audit at the same viewport and state.
3. Check first-time comprehension, keyboard order, screen-reader announcements, 44-pixel touch
   targets, reduced motion, popup/new-tab expectations, and whether expiry/retry copy remains clear.
4. Keep provider names, fallback depth, internal warnings, exact completion-time promises, and
   universal download claims out of the product.
5. Implement only P0/P1 evidence-backed corrections and repeat screenshot QA in English and
   Simplified Chinese.

Exit gate:

- a first-time user completes the real authorized download without understanding provider routing;
- download handoff and expiry behavior are understandable on desktop and mobile;
- no P0 UX/accessibility finding remains;
- no new public operational or provider metadata is introduced.

Expected effort: 1 day after one exact live test authorization.

### Work item 11.3 — Pilot evidence and delivery-outcome ADR

Create a new ADR before adding persistence or scheduled evaluation.

The ADR must fix:

- exact provider/platform/region evidence windows and attribution;
- distinct-task sample rules that prevent queue retries or canaries manufacturing volume;
- sanitized delivery outcomes for ticket creation, redirect-policy validation, expiry, and browser
  handoff without task, URL, candidate, format, media, caller, header, cookie, or payload data;
- daily aggregation, time-zone boundaries, retention, cleanup, late-arriving data, and replay;
- separation of canary, internal, and public observations;
- three-complete-day calibration and policy-lock workflow;
- scheduled evaluator ownership, optimistic concurrency, stale evidence, cooldown, and operator
  recovery review;
- protected diagnostics and evidence export boundaries.

Exit gate:

- evidence can drive a restrictive guard but can never create a grant or approval;
- insufficient/missing data holds or reduces according to policy and never counts as healthy;
- all stored and exported evidence is demonstrably free of public content and delivery secrets.

Expected effort: 0.5–1 day.

### Work item 11.4 — Evidence aggregator and scheduled restrictive evaluator

Implement the accepted ADR without changing public OpenAPI.

1. Add migrations and repositories for sanitized delivery outcomes, daily evidence summaries,
   calibration proposals, and review records with bounded retention and cleanup indexes.
2. Aggregate resolution success, normalized latency, challenge/schema/timeout rates, invalid-result
   rate, fallback depth, candidate coverage, ticket success, redirect validation, and expiry
   sufficiency for the exact tuple.
3. Label canary/internal/public samples and count distinct tasks without persisting their IDs in the
   summary boundary.
4. Add a singleton scheduled evaluator that reads only locked policies and may hold, reduce, deny,
   or mark recovery eligible for operator review.
5. Publish expiring guard snapshots for Workers while keeping PostgreSQL authoritative.
6. Add protected, `no-store` diagnostics for aggregate freshness, sufficiency, policy version, and
   guard reason only.
7. Extend cleanup, migration, stale-state, rollback, privacy, and residue verification.

Exit gate:

- deterministic fixtures prove healthy, insufficient, stale, latency, challenge, invalid-result,
  delivery failure, absolute stop, recovery, and operator-deny precedence;
- evaluator retries are idempotent and cannot raise allocation;
- `pnpm verify:work-item-11` passes without live providers and cleans its data.

Expected effort: 2–3 days.

### Work item 11.5 — Internal deployment preflight

Prepare but do not enable traffic.

1. Define the reviewed internal region, deployment identity, trusted proxy boundary, secret
   ownership, provider egress, Redis/PostgreSQL durability, cleanup schedule, diagnostics
   credential, alert route, and rollback owners.
2. Verify real providers remain process-disabled until production/commercial approval references
   are current and in scope.
3. Rehearse provider-wide deny, stale rollout, stale guard, database/Redis loss, Worker restart,
   delivery expiry, cleanup delay, and recovery review without Web/API deployment.
4. Produce a preflight report containing only opaque approval/evidence references and sanitized
   aggregate results.

Exit gate:

- every absolute prerequisite in ADR-0008 has an owner and current opaque reference;
- a missing prerequisite prevents `internal` startup;
- emergency deny propagation and fail-closed behavior meet the reviewed bound.

Expected effort: 1 day; production/commercial approval is an external dependency.

### Work item 11.6 — Real calibration and staged X pilot

This work starts only after the independent approval gate passes.

1. Run at least three complete consecutive internal days.
2. Review measured baselines and lock the first numeric policy; do not pre-fill thresholds.
3. Promote one reviewed region through internal, 5%, 25%, 50%, and 100% only by audited operator
   decisions after each required observation window.
4. Exercise automatic rollback, manual provider-wide deny, stale telemetry, cooldown, recovery
   eligibility, and operator restoration against the approved deployment.
5. Record seven consecutive healthy, sample-sufficient daily reviews for both X providers in the
   sanitized evidence index.
6. Mark work item 10/11 pilot closure only when deterministic and operational gates both pass.

Exit gate:

- three-day calibration and seven-day observation are real elapsed windows;
- both providers meet the locked resolution, delivery, fallback, challenge, invalid-result, and
  latency policy with sufficient samples;
- the Product Design real-journey audit remains valid under staged traffic;
- `config/x-pilot-evidence.json` can safely move from `pending` to `complete`.

Expected effort: 3 internal days plus at least 7 external observation days.

## Priority and dependencies

| Order | Work item | Can start now | Blocking dependency |
| --- | --- | --- | --- |
| 1 | 11.0 baseline | Yes | Current verified worktree |
| 2 | 11.1 local launcher | Yes | 11.0 |
| 3 | 11.2 real Product Design audit | With exact authorization | 11.1 and one reviewed test URL |
| 4 | 11.3 evidence ADR | Yes | ADR-0008 and 10.5 implementation |
| 5 | 11.4 aggregator/evaluator | After ADR | 11.3 |
| 6 | 11.5 deployment preflight | Partially | 11.4 and deployment decisions |
| 7 | 11.6 staged pilot | No | Independent approval and all preflight gates |

Engineering work before the external gate is approximately 6–8 days. Real-time calibration and
observation cannot be compressed or replaced with fixtures.

## Product Design checkpoints

- Work item 11.1: verify launcher errors and ready-state language are actionable, but do not expose
  them in the consumer UI.
- Work item 11.2: mandatory actual-journey screenshot audit before internal traffic.
- Work item 11.4: protected diagnostics information architecture review; no consumer admin UI.
- Work item 11.6: repeat the success/fallback/expiry journey review before 25% and after 100%.

## First executable step

Start work item 11.0 by reviewing, committing, and pushing the verified work item 10 baseline. Then
implement 11.1 so future local tests start one clean stack with explicit provider egress and no
manual process cleanup.
