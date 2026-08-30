# TikDD development roadmap

- Rebaseline source: [`docs/project/current-state-audit.md`](project/current-state-audit.md)
- Repository checkpoint: `main@416c0f1`
- Roadmap revision date: 2026-08-30

This roadmap starts from the audited repository state, not from historical completion labels. TikDD
already has the core Provider, routing, health, rollout, Delivery, Admin, CMS, locale, and technical
SEO architecture. Future work extends or productizes those systems. It does not recreate them.

The immediate production objective remains closure of the X production baseline. The repository has
no `stable` platform catalog entries today. A recognized or planned catalog entry is therefore not
a claim that TikDD can currently download from that platform.

## Baseline classification

### Completed engineering baseline

- Decoupled Web, API, Worker, Delivery, Canary, evaluator, cleanup, Admin API, and Admin services.
- Dynamic platform slugs with explicit Host recognition and spoofed-Host rejection.
- Runtime-validated Provider manifests with per-platform priority, delivery modes, evidence state,
  and region eligibility.
- Sequential bounded fallback, typed error decisions, sanitized attempts, health aggregation,
  circuits, restrictive guards, rollout controls, and deterministic first-choice traffic shares.
- Two delivery-verified X adapters and redirect Delivery policies.
- Password-authenticated owner Admin with route management, platform presentation, structured
  content, locales, immutable publication snapshots, and technical SEO eligibility.
- Work Item 13 generic capability-evidence and traffic-distribution baseline merged at `416c0f1`.

### Unresolved production debt

- The reviewed NL deployment region is inconsistent with the TwitterSaver and SSSTwitter Manifest
  regions (`global` and `canary-global`).
- The scheduled Canary configuration has no exact SSSTwitter/X tuple.
- Production application deployment and recurring Canary/evaluator/cleanup supervision are not
  represented in the repository.
- Real deployment preflight, three-day calibration, policy review/lock, staged pilot, seven healthy
  daily reviews, and final browser delivery verification remain incomplete.
- `config/x-pilot-evidence.json` remains `pending`; deterministic CI cannot close this evidence.

## Coordinated future lanes

The lanes may progress concurrently only where their gates permit. Lane B can productize existing
operations while Lane A gathers evidence. Lane C can prepare non-indexable content and feasibility
research, but production activation and indexing remain downstream of Lane A and platform-specific
qualification.

### Lane A — Production Foundation

Primary objective: close the existing X production-baseline debt without weakening Manifest,
Delivery, rollout, or evidence boundaries.

This lane owns:

- Provider/deployment region consistency;
- exact SSSTwitter/X scheduled Canary coverage;
- reproducible application deployment;
- recurring Canary, evaluator, and cleanup supervision;
- real deployment preflight;
- three-day internal calibration and policy review/lock;
- staged X pilot and seven consecutive healthy reviews;
- real owner/browser delivery-journey verification;
- final evidence-backed production checkpoint.

No additional platform may receive production traffic or `stable` promotion before this lane's X
Production Evidence Gate closes.

### Lane B — Platform Operations

Primary objective: make existing qualification and operational truth understandable and usable by
the single site owner.

This lane owns:

- graphical Provider/platform/region qualification journeys;
- calibration proposal visibility and reviewed policy-lock workflow;
- evidence sufficiency and freshness visibility;
- deployment-region versus Manifest eligibility diagnostics;
- scheduled-Canary coverage, last-run, freshness, and failure diagnostics;
- platform support-truth presentation;
- an operational readiness dashboard.

Provider capabilities, Host and media policies, region eligibility, delivery modes, and platform
Host rules remain code-reviewed boundaries. Admin may order, allocate, cap, pause, or deny within an
existing capability. It must not become a second capability authority or qualification engine.

### Lane C — Growth

Primary objective: prepare high-quality localized acquisition content without publishing unsupported
availability claims.

This lane owns:

- editorial preparation for platform landing pages;
- explicit noindex pre-production page state;
- fixed code-owned JSON-LD templates derived from validated published fields;
- a controlled GEO/answer-oriented content model;
- locale and interface-copy completeness;
- content quality, review, and publication flow.

The existing SEO eligibility system remains authoritative. Indexing continues to require all of:

1. `stable` platform catalog state;
2. qualified and monitored production routing for the deployment region;
3. safe verified Delivery coverage;
4. locale/content readiness;
5. successful immutable publication eligibility.

No second SEO eligibility system or arbitrary JSON-LD editor will be introduced.

## Revised future Work Items

### Work Item 14 — Project rebaseline

Scope: documentation and roadmap alignment only.

Deliverables:

- establish `main@416c0f1` as the audited engineering checkpoint;
- preserve the audit's distinction between completed code and missing operational evidence;
- replace obsolete future-roadmap assumptions with the three coordinated lanes;
- retain historical Work Item and Milestone context below;
- record the stale Cloudflare Access wording in `apps/admin-api/README.md` as a documentation
  cleanup item; ADR-0011 and password-authenticated runtime behavior remain authoritative.

Exit: this roadmap and the current-state audit pass repository documentation checks and are reviewed
as one documentation-only rebaseline. No runtime or production state changes are part of Work Item
14.

### Work Item 15 — X production configuration consistency

Lane: A.

Implementation status (2026-08-30): complete on the Work Item 15 branch. Region consistency and
fail-closed preflight hardening are implemented, and the new owner-authorized exact SSSTwitter/X
tuple is configured for recurring bounded scheduled Canary checks. No Canary was executed and no
production traffic or rollout grant was created.

Resolve the reviewed deployment-region versus Provider Manifest contradiction and configure an
exact authorized SSSTwitter/X scheduled Canary tuple.

Required outcomes:

- select one consistent, reviewed concrete production-region model;
- update only the code-owned Manifest/deployment boundary appropriate to that decision;
- prove the Router sees both intended deliverable X Providers in the selected region;
- add the exact authorized SSSTwitter/X Canary pairing and deterministic configuration tests;
- make preflight validation detect future deployment/Manifest region contradictions.

Admin must not expand a Provider capability or region. No traffic is enabled by this Work Item.

### Work Item 16 — Production deployment foundation

Lane: A.

Phase A status (2026-08-30): the reviewed deployment design freeze is merged into `main`.

Phase A.1 alignment selects the shared Ubuntu 24.04 `nl` host model: host systemd owns shared
cloudflared, host Nginx serves the existing PHP site and loopback-published TikDD request services,
and TikDD Compose owns neither ingress service. Final public 80/443 closure occurs only after every
shared site passes Tunnel verification. Admin BFF/Admin API retain the approved shared-network-
namespace and loopback-only API boundary.

Phase B status (2026-08-30): the reproducible production foundation is implemented on
`codex/work-item-16-deployment-implementation`. It adds three production image targets, dedicated
Compose, external secret bootstrap, private datastores, explicit migration/preflight/operational
jobs, Nginx templates, immutable release/rollback tooling and an offline topology gate. No real
host, Cloudflare, firewall, Provider, rollout or production migration action was performed. Work
Item 17 scheduling and the X Production Evidence Gate remain pending.

Phase C1 status (2026-08-30): a read-only audit of the actual NL host returned the historical
classification `NOT READY FOR DEPLOYMENT`. Phase C1.1 fixes the remediation model without rewriting
that result. The existing NL VPS is the approved target. Phase C2 uses staged coexistence and
observed host-resource gates while preserving permanent shared MySQL, host Redis, shared
Nginx/PHP-FPM/panel services and all existing websites. Another VPS, an 8 GB prerequisite, stopping
MySQL or stopping host Redis are not Work Item 16 readiness requirements.

Private TikDD PostgreSQL and TikDD Redis intentionally coexist with the permanent host datastores.
Admin remains on demand and operational jobs remain one-shot. Only resources proven
`legacy-TikDD-exclusive` may be stopped after new-stack and ingress verification; nothing is deleted
during the initial rollback-confidence period. The first proven-empty PostgreSQL database may be
initialized without existing off-host backup, after which encrypted off-host backup and restore
testing are P0 production hardening.

Phase C2 is gated separately: Gate A prepares containers, Gate B proves shared-host coexistence,
Gate C performs Tunnel/Nginx ingress cutover while retaining the legacy TikDD rollback path, and
Gate D stops only proven legacy-TikDD-exclusive resources. None of these gates grants Provider
traffic or starts Work Item 17.

Add reproducible deployment for the current service architecture in the selected production
environment. It must deploy the required application services rather than PostgreSQL and Redis only.

The deployment design must preserve process/network separation, loopback/private Admin boundaries,
Nginx/Cloudflare origin protection, secret isolation, production mock refusal, health/readiness
checks, and rollback. Exact hosting substrate and process topology require an implementation-time
decision based on the selected NL environment.

Exit: a clean environment can reproducibly provision and start the reviewed public and private
application processes without enabling public Provider allocation.

### Work Item 17 — Scheduled operational services

Lane: A, with read-model dependencies consumed by Lane B.

Establish recurring production supervision for:

- Canary;
- evidence evaluator;
- cleanup.

Each service must expose sanitized last-run, next/expected-run, freshness, lease/singleton state,
and bounded failure state. Missing or stale execution must fail readiness safely and must never be
interpreted as healthy. Scheduling must reuse the existing application entry points and persistence
models.

Exit: restart-safe recurring execution and observable freshness are proven in the deployment
environment without contacting any Provider outside exact authorized Canary tuples.

### Work Item 18 — Qualification Admin productization

Lane: B.

Expose the existing qualification, calibration, policy, and evidence primitives as one coherent
owner workflow.

Required views/actions:

- exact Provider/platform/region qualification state and prerequisites;
- calibration window/sample completeness;
- proposed policy values and evidence provenance;
- explicit owner review and policy lock;
- promotion/hold/deny eligibility and restrictive guard effects;
- optimistic revision, idempotency, bounded reasons, and authoritative receipts.

This Work Item must call the existing backend model. It must not create a second qualification
engine, bypass approval/Manifest/Delivery gates, or allow automatic traffic grants.

### Work Item 19 — Operational truth dashboard

Lane: B.

Present a single, explainable support ladder that distinguishes:

- catalog recognition;
- Provider resolution capability;
- delivery verification;
- scheduled-Canary status and freshness;
- current runtime production availability;
- platform lifecycle;
- SEO/index eligibility.

The dashboard must expose exclusion reasons such as region mismatch, no delivery mode, failed/stale
Canary, missing rollout grant, restrictive guard, open circuit, and incomplete content. It must not
show planned catalog breadth as downloadable support.

Exit: the owner can answer “why is this platform unavailable or non-indexable?” from sanitized,
authoritative projections without source-code inspection or direct database queries.

## X Production Evidence Gate

This is a real operational checkpoint, not an ordinary code-completion Work Item. It begins only
after Work Items 15-17 provide a consistent deployed environment and current signals.

Required evidence:

1. at least three complete consecutive internal calibration days for each reviewed X
   Provider/platform/region tuple;
2. an evidence-backed proposal reviewed and locked as the active pilot policy;
3. a bounded staged pilot under existing rollout and restrictive-guard controls;
4. seven consecutive healthy daily evidence reviews with sufficient fresh samples;
5. one real end-to-end owner/browser delivery verification under the intended production route;
6. a final review reconciling deployment, approval, health, Delivery, policy, and product evidence.

Deterministic CI, fixtures, a closed circuit, a successful isolated Canary, or a checked-in `ready`
boolean cannot complete this gate. Missing/stale evidence holds or reduces traffic. Only the owner
rollout action may grant or increase allocation.

Exit: the evidence index can truthfully move from `pending` to complete for the exact reviewed X
scope, and the production checkpoint is recorded without exposing private URLs or Provider data.

### Work Item 20 — Instagram Provider feasibility

Lane: B with Lane C preparation. May run during the X evidence window, but cannot enable Instagram
production traffic, stable promotion, or indexing.

Evaluate authorized Provider candidates using exact reviewed test tuples. Cover adapter feasibility,
normalized errors, region behavior, delivery feasibility, challenge behavior, request bounds, and
commercial/technical constraints. Reuse the existing platform catalog entry and Provider research
boundary. Do not add a generic extractor or treat yt-dlp catalog presence as current availability.

Exit: an evidence-backed go/no-go and selected Provider/delivery approach, or a documented decision
that no safe candidate currently exists.

### Work Item 21 — Instagram Provider adapter

Lane: B.

Implement the selected capability through the existing Provider architecture:

- runtime-validated Manifest capability and per-platform priority;
- explicit page Host and redirect/network bounds;
- sanitized deterministic success/failure fixtures;
- normalized result and typed error decisions;
- candidate-mode and delivery-host policy tests when delivery is approved;
- production-disabled activation and exact region scope.

Reuse the current contracts, Router, attempt ledger, health, rollout, Delivery, and evidence systems.
Do not introduce an Instagram-specific task API or downloader architecture.

### Work Item 22 — Instagram qualification

Lane: B, gated by Work Item 21 and by the X Production Evidence Gate for any production allocation.

Qualify exact Provider/Instagram/region tuples through the existing Canary, calibration, rollout,
Delivery-outcome, circuit, and evidence system. Resolution-only proof may advance technical
feasibility but cannot qualify production download delivery.

Exit: the route has current reviewed delivery evidence and an operator-approved bounded rollout;
catalog promotion remains a separate product decision after the required observation window.

### Work Item 23 — Instagram landing page

Lane: C. Target public route: `/instagram-downloader/`.

Create the page through the existing platform-page schema, locale registry, structured editor,
preview, immutable publication snapshot, and SEO passport. Editorial work may precede production
qualification, but the page remains explicitly non-indexable and absent from sitemap/hreflang until
the existing eligibility gate passes.

Exit: reviewed localized content is publication-ready, and indexability is still derived rather than
manually asserted.

### Work Item 24 — Structured data foundation

Lane: C.

Implement fixed code-owned JSON-LD templates derived only from validated fields in the active
published snapshot. Initial schema candidates are:

- `SoftwareApplication`;
- `FAQPage`;
- `HowTo`;
- `BreadcrumbList`.

Templates must match visible content, page type, locale, canonical path, and eligibility. Admin may
edit the validated source fields but cannot submit arbitrary JSON-LD, scripts, remote entities, or
executable markup. This changes the public structured-data boundary and requires an ADR before
implementation.

### Work Item 25 — GEO content model

Lane: C.

Introduce a controlled answer-oriented platform-page model containing concise direct answers,
limitations, review metadata, and a product-approved source/citation model. Extend the existing
structured CMS and publication workflow rather than introducing a separate content store.

The model must prevent mass-generated thin pages, unsupported availability claims, hidden fallback
translations, and structured data that does not match visible content. The citation, review, and
content-freshness semantics are a new product domain and require an ADR before persistence or public
rendering changes.

## Reusable platform launch pipeline

Every platform after Instagram follows the same evidence path:

```text
Provider research
  -> adapter
  -> deterministic fixtures
  -> exact scheduled Canary
  -> tuple qualification
  -> delivery verification
  -> bounded rollout
  -> stable platform promotion
  -> localized landing page
  -> indexing eligibility
```

The ordering is a gate sequence, not a promise that every researched platform will launch. A failed
or challenged Provider may remain documented as technical evidence without receiving delivery,
traffic, stable status, or an indexable page. Facebook, Pinterest, Reddit, Threads, and other future
candidates reuse this process and the same normalized architecture.

## Explicit duplication guard

Future work must not recreate these existing systems:

- Provider registry and capability model;
- sequential bounded fallback engine;
- deterministic first-choice traffic distribution;
- health aggregation and circuit breakers;
- rollout, restrictive guard, and emergency kill switch;
- password-authenticated Admin application and Admin API;
- graphical routing controls;
- structured CMS, revisions, immutable publication, and recovery;
- locale registry;
- canonical, hreflang, robots, and sitemap generation;
- stable-before-indexing gate;
- public direct-link API;
- generic media proxy.

The last two are existing prohibited boundaries, not missing features. Future entries may extend or
productize the other systems, but replacement requires explicit architecture review and an ADR.

## Architectural invariants for future work

1. Provider-specific payloads remain inside `packages/providers` and normalize through public
   contracts.
2. Platform IDs remain explicit catalog slugs with reviewed Host rules and spoofed-Host tests.
3. Provider capabilities, priorities, network boundaries, region eligibility, delivery modes, and
   platform Host rules remain code-owned.
4. Fallback remains sequential, bounded, deadline-aware, and terminal-aware.
5. Admin may narrow runtime policy but cannot invent Provider capability or network access.
6. Automated controls may hold, reduce, or deny; they cannot grant or raise traffic.
7. Delivery never becomes a generic proxy and every delivery target uses a reviewed Host policy.
8. Public results never expose upstream URLs, credentials, cookies, headers, candidates, or
   Provider-native payloads.
9. Public Web consumes complete immutable published snapshots and never exposes drafts.
10. Task, result, Admin, API, Delivery, and other private/dynamic pages remain non-indexable.
11. Only stable, deliverable, monitored, localized, publication-eligible platform pages may be
    indexed.
12. Qualification, rollout, health, Delivery, platform lifecycle, and SEO eligibility remain
    independent fail-closed gates.
13. Mock and failure-injection Providers remain development-only and refuse production startup.

## Roadmap decisions still requiring implementation evidence

- The exact production hosting substrate and process topology for the selected NL environment are
  not defined by the repository.
- The production scheduler/supervisor technology for recurring services is not selected.
- Work Item 15 selected explicit reviewed concrete deployment regions in Provider Manifests; Admin
  cannot broaden that code-owned region admission at runtime.
- The exact authorized SSSTwitter/X scheduled-Canary input is recorded in
  `config/provider-canaries.json`; removing it or explicit owner revocation ends that authorization.
- The start date and sufficient sample thresholds for the real X evidence window cannot be inferred
  from source control.
- GEO citation/source requirements and content-review ownership need product decisions before Work
  Item 25 persistence or UI design.

## Historical roadmap context (preserved)

The Milestone 0-6 text below records the architecture's original direction and is retained for
traceability. It is not the authoritative current-state report. Completion and production-readiness
claims must be interpreted through the rebaseline audit and the revised Work Items above.

## Milestone 0 — Extensible foundation (historical)

- Executable pnpm TypeScript monorepo with Web, API, worker, and delivery boundaries.
- Dynamic platform slug contract and curated platform catalog seeded from common yt-dlp families.
- Runtime-validated provider manifests with per-platform priorities and region eligibility.
- Sequential fallback router, terminal/retryable error taxonomy, time budgets, and attempt ledger.
- PostgreSQL task state, Redis/BullMQ queue, development mock, OpenAPI, English and Simplified
  Chinese landing pages, CI checks, threat model, and ADRs.

Exit criteria: `pnpm check` passes and a Docker-backed mock task completes through Web → API → queue
→ worker → PostgreSQL, including one recorded provider attempt.

## Milestone 1 — Provider feasibility lab

- TwitterSaver and DLPanda adapters now have validated manifests, bounded HTTP clients, sanitized
  fixtures, typed error mapping, deterministic fallback tests, and an authorized technical canary
  corpus. TwitterSaver resolved the X canary; DLPanda returned a regional challenge and safely
  triggered fallback. Both remain disabled for production.
- Do not integrate credentials until terms, data handling, and commercial use are approved.
- Add one isolated adapter package per site with a manifest, sanitized fixtures, response size
  limits, timeouts, concurrency control, error mapping, and contract tests.
- Create an authorized test corpus across 5–8 platform families and important URL variants.
- Scheduled authorized canaries now persist expiring metadata-only measurements for status, latency,
  formats, link lifetime, normalized failures, and fallback depth. Geographic comparison and cost
  calibration remain pilot operations.
- Provider/platform/region aggregation, revisioned Redis circuit state, atomic half-open leases, and
  Router consumption are implemented behind an explicit versioned-policy gate.
- A development-only failure-injection adapter proves priority order, fallback, terminal stops, and
  route budget exhaustion without participating in production routing.
- [ADR-0008](architecture/adr/0008-provider-qualification-and-pilot-controls.md) defines the
  candidate-to-stable qualification lifecycle, independent technical-test and production approval,
  three-day internal SLO calibration, operator-only promotion, and a future restrictive automatic
  guard. Its implementation begins with work item 10.1; no provider is enabled by this decision
  alone.
- [ADR-0009](architecture/adr/0009-pilot-evidence-and-delivery-outcomes.md) is implemented with exact
  provider/platform/region/class evidence windows, distinct-task sampling, unlinkable delivery
  outcomes, UTC sealing/replay/retention, protected aggregate diagnostics, and a scheduled
  restrictive evaluator. Work item 11.5 adds the final fail-closed engineering boundary before
  reviewed internal deployment inputs.
- Work item 11.5 implements a deny-first deployment plan/report, short-lived runtime-bound
  attestation, API/Worker internal-startup enforcement, and deterministic failure rehearsal. Its
  checked-in plan remains pending until deployment scope, Provider-use confirmation, and current
  technical signals exist; no audit workflow is planned.
- Work item 10.1 rejected DLPanda/X in the current region after `provider_challenge` and selected
  SSSTwitter at `canary-ready` after a corrected-parser canary. SSSTwitter remains disabled and out
  of the worker until work item 10.2 completes its exact delivery-host policy and candidate mapping.
- Work item 10.6 provides `pnpm verify:work-item-10`, a 12-stage offline Docker/CI gate covering both
  real X adapters, routing, delivery, rollout/guard controls, cleanup, public-state contracts,
  verification-residue checks, and the full repository build. It passes while the separate
  sanitized seven-day evidence index remains `pending`; production traffic stays denied.

Exit criteria: at least two providers demonstrate deterministic fallback, and each launch candidate
platform has seven consecutive healthy canary runs with documented compliance approval.

## Milestone 2 — First production resolution path

- Runtime per-provider/platform/region/percentage rules, emergency deny, durable audit, and expiring
  Redis distribution are implemented; production rules remain disabled until reviewed rollout.
- Task idempotency, active canonical-source suppression, and task-ID queue deduplication are
  implemented. Trusted-proxy-derived anonymous quotas plus distributed provider concurrency are
  also implemented. Independently scheduled bounded retention cleanup, dry-run metrics, and
  Docker-backed cascade/repeat verification are implemented; authenticated user policy and broader
  abuse signals remain.
- A protected read-only diagnostics surface reports health, rollout, priority, recent sanitized
  failures, fallback depth, and canary health without entering public OpenAPI or Web.
- Store internal delivery candidates separately from the public normalized result, encrypted or
  short-lived.
- Publish 3–5 stable platform families based on evidence; keep experimental/planned entries out of
  indexable SEO pages.

Exit criteria: authorized public URLs resolve without provider-native payloads, secrets, or upstream
URLs crossing the public API boundary, and rollout can be disabled without a Web deploy.

## Milestone 3 — Controlled media delivery

- Implement validated, short-lived redirect delivery first.
- Add byte-range proxy only for providers that require server-held headers.
- Add signed tokens, host and DNS validation, bandwidth and concurrency accounting, file-size limits,
  audit events, and abuse response controls.
- Add S3-compatible temporary objects and lifecycle rules for merge/transcode jobs.

Exit criteria: the API never transfers media bytes; the delivery service cannot proxy an arbitrary
host; temporary artifacts expire automatically.

## Milestone 4 — Isolated yt-dlp and FFmpeg provider

- Build a resource-limited runner image with pinned yt-dlp and FFmpeg versions and no inbound network
  access.
- Feed yt-dlp JSON through the same provider and normalized-result contracts.
- Generate a versioned extractor snapshot for catalog discovery; keep host admission curated.
- Add cookies only through an explicit secret boundary for approved owned accounts, never from user
  input or public API fields.
- Canary dependency updates, retain the previous image, and support fast rollback by platform and
  region.
- Add merge/transcode states, progress events, CPU/memory/disk limits, and cancellation.

Exit criteria: yt-dlp can be enabled, disabled, upgraded, or rolled back without deploying Web/API,
and a failing extractor cannot exhaust the general worker pool.

## Milestone 5 — Platform and SEO expansion

- Promote catalog entries from planned → experimental → stable using explicit operational gates.
- Add distinct, human-reviewed platform pages only for stable locale/platform combinations.
- Add reciprocal hreflang, locale sitemaps, structured data, localized limitations, and help content.
- Keep tasks, results, catalog diagnostics, and temporary files non-indexable.
- Add more locales through editorial review and measure Core Web Vitals and accessibility budgets.

Exit criteria: every indexable platform page has a working monitored provider in that region and
locale, and no thin pages are generated from the raw yt-dlp list.

## Milestone 6 — Reliability and scale

- Partition queues and autoscaling by provider runtime kind, region, and resource profile.
- Add per-provider concurrency leases, distributed circuit breakers, budgets, SLOs, alerts, and
  runbooks.
- Add controlled traffic experiments for score weights and optional hedged requests.
- Add disaster recovery, data retention verification, privacy operations, takedown operations, and
  dependency supply-chain controls.

Exit criteria: failure of one provider, region, or heavy media workload does not degrade task
creation or unrelated platform families.

## Definition of done for every new adapter

1. Compliance owner and upstream terms review are documented.
2. Manifest and platform capability matrix are validated at startup.
3. Sanitized success and failure fixtures cover every mapped error class.
4. Contract, timeout, cancellation, SSRF/redirect, and secret-leak tests pass.
5. Scheduled canaries, metrics, circuit thresholds, and a rollback flag exist.
6. The adapter launches disabled and is promoted gradually by platform and region.
