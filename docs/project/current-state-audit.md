# TikDD current-state rebaseline audit

- Audit date: 2026-08-30
- Repository checkpoint inspected: `main` at `416c0f1`
- Scope: repository evidence only; no live Provider requests or production changes
- Status vocabulary: `Complete`, `Partial`, `Backend only`, `Operator only`, `Planned`, `Missing`, `Unclear`

## 1. Executive summary

TikDD is no longer an early downloader prototype. The repository contains a decoupled public Web,
resolve API, queue Worker, Delivery service, scheduled Canary service, evidence evaluator, cleanup
service, private Admin API, and graphical owner console. It also has durable task/provider state,
runtime route policies, deterministic traffic shares, deny-first rollout controls, circuit breakers,
sanitized attempt and delivery evidence, immutable content publication, and technical SEO gates.

The strongest completed product path is X resolution and redirect delivery through two real
adapters, TwitterSaver and SSSTwitter. DLPanda is a multi-platform resolution adapter, but every
DLPanda capability remains non-deliverable. The platform catalog recognizes 44 explicit platform
slugs; only `tiktok`, `youtube`, and `x` are `experimental`, the remaining 41 are `planned`, and no
platform is `stable`. Catalog recognition must therefore not be presented as verified download
support.

The engineering baseline is substantially complete, but the production-baseline checkpoint is not.
The checked-in Work Item 11 preflight declares an `nl` deployment ready, while both deliverable X
Provider manifests allow only `global` and `canary-global`. A Worker running in `nl` will filter
both routes out. The scheduled-canary configuration also has no SSSTwitter/X tuple, and the required
three-day calibration and seven consecutive daily evidence reviews have not occurred. The evidence
file is explicitly `pending` with no daily reviews. No production deployment or scheduler wiring is
present in the repository.

The next roadmap should reuse and productize the existing control plane rather than recreate
routing, health, Admin, CMS, or SEO infrastructure. Broader production platform activation and
indexable platform landing pages should wait until the X production checkpoint is made internally
consistent and its live evidence requirement is closed. Non-traffic product work can continue in
parallel when it does not weaken that checkpoint or make unsupported public claims.

## 2. Current production checkpoint

### What Work Item 11 has completed

The repository has completed the deterministic engineering portion of Work Item 11:

- A fail-closed deployment preflight model and verification scripts exist.
- The intended deployment identity is `tikdd`, region is `nl`, and the declared X Provider pair is
  TwitterSaver plus SSSTwitter.
- Production-use confirmation flags are present for both X Providers.
- X has two adapters whose capabilities are marked `delivery_verified` for redirect delivery.
- Delivery tickets are one-use and candidate URLs remain internal and encrypted.
- Runtime rollout rules, restrictive pilot guards, circuit breakers, route-policy publication,
  deterministic first-choice shares, emergency deny, and rollback primitives are implemented.
- Sanitized attempts, canary measurements, delivery outcomes, daily evidence summaries, policy
  proposals, guard actions, and cleanup persistence exist.
- Protected diagnostics and the owner Admin application can display operational state.
- The CI baseline runs deterministic Work Item 11 verification and the repository-wide check
  without contacting a live Provider or enabling traffic.

Evidence:

- `docs/work-item-11-implementation-plan.md`
- `docs/work-item-11-1-implementation.md`
- `docs/work-item-11-4-implementation.md`
- `docs/work-item-11-5-implementation.md`
- `docs/work-item-11-6-implementation.md`
- `config/x-internal-preflight.json`
- `packages/deployment-preflight/src/index.ts`
- `packages/rollout-control/src/index.ts`
- `packages/pilot-evidence/src/index.ts`
- `.github/workflows/ci.yml`

### What remains

1. **Resolve the production-region contradiction.** TwitterSaver and SSSTwitter declare
   `regions: ["global", "canary-global"]`, while the checked-in deployment and Worker region is
   `nl`. The Router's region eligibility filter makes both Providers unavailable to the declared
   deployment. Either the reviewed manifests must explicitly admit `nl`, or the deployment policy
   must use a reviewed region already admitted by the manifests. This is a code/security-boundary
   decision, not an Admin override.
2. **Authorize and configure an exact SSSTwitter/X scheduled canary tuple.** The Canary runtime
   supports SSSTwitter, but `config/provider-canaries.json` contains only TwitterSaver/X and
   DLPanda/TikTok. A dual-Provider X evidence window cannot be obtained from the checked-in
   configuration.
3. **Run a real deployment preflight from measured deployment state.** The current preflight file
   records owner assertions and booleans. It does not prove Manifest region eligibility, Provider
   reachability, live scheduler operation, current rollout rules, or current Redis/PostgreSQL state.
4. **Deploy and schedule the operational services.** The repository contains service processes and
   scripts, but Docker Compose only provisions PostgreSQL and Redis. The actual NL application
   deployment and recurring canary, evaluator, and cleanup schedules are not repository evidence.
5. **Complete at least three full internal calibration days** for each reviewed Provider/platform/
   region tuple, then review and lock the numeric pilot policy.
6. **Complete the staged pilot and seven consecutive daily healthy evidence reviews.**
   `config/x-pilot-evidence.json` is `pending`, requires seven days, and has an empty
   `dailyReviews` array.
7. **Verify the real owner/browser delivery journey under the intended staged route.** Current
   delivery telemetry records ticket/redirect-policy outcomes; it does not prove that an end user
   completed the browser download.
8. **Record the final evidence-backed checkpoint.** CI is deliberately unable to close the live
   observation requirement.

### Current blockers

- The `nl` versus `global`/`canary-global` mismatch prevents the configured production route from
  being eligible.
- The exact SSSTwitter/X scheduled-canary authorization is absent.
- No live observation evidence, locked calibrated policy, or daily review is checked in.
- Runtime deployment, scheduler state, current database policies, and protected diagnostics are
  outside the repository and were not available to this audit.

### Should broader platform work start?

Broader **production activation, support claims, and indexable platform landing pages should not
start yet**. Doing so would multiply an unresolved deployment and qualification problem. Safe
parallel work is limited to reusing existing architecture: adapter feasibility, deterministic
fixtures, Admin productization, editorial preparation in non-indexable states, and documentation.
No new platform should be promoted to `stable`, enabled for production traffic, or indexed until
its exact Provider/platform/region route passes the same delivery and evidence boundary.

## 3. Capability matrix

| Capability | Status | Actual state and evidence |
| --- | --- | --- |
| Service separation | Complete | Web, API, Worker, Delivery, Canary, evidence evaluator, cleanup, Admin, and Admin API are separate workspace applications. See `apps/*/package.json`, `README.md`. |
| Unified public contracts | Complete | Runtime-validated task/result models normalize Provider output; public results omit candidates and upstream identity. See `packages/contracts/src/index.ts`, `openapi/tikdd.yaml`, API/Worker tests. |
| Dynamic platform IDs | Complete | Platform IDs are validated slugs, not a closed enum. See `packages/contracts/src/index.ts`, `packages/platform/src/index.ts`. |
| Explicit host recognition and spoof rejection | Complete | Catalog-owned exact/subdomain rules, canonicalization, and spoofed-host tests are present. See `packages/platform/src/index.ts`, `packages/platform/test/detect-platform.test.ts`. |
| Platform catalog | Complete | 44 explicit catalog entries: 3 experimental and 41 planned; none stable. Catalog entries represent recognition, not guaranteed downloads. See `packages/platform/src/index.ts`. |
| Platform lifecycle management | Partial | `planned`/`experimental`/`stable` exists, but state is code-owned and there is no runtime promotion workflow. Admin manages presentation/readiness only. See platform catalog and `apps/admin-api/src/services/platforms.ts`. |
| Platform region configuration | Partial | Region is enforced at Provider capability routing, not modeled as a mutable platform property. The current NL/X configuration conflicts with both deliverable manifests. See Provider adapters, `packages/providers/src/index.ts`, `config/x-internal-preflight.json`. |
| Provider manifest validation | Complete | Every Provider has runtime-validated kind, regions, timeout/cost, and per-platform priority, delivery modes, and verification status; invalid/duplicate declarations fail. See `packages/providers/src/index.ts` and tests. |
| Real Provider adapters | Partial | TwitterSaver and SSSTwitter support deliverable X; DLPanda declares 12 resolution-only platforms. No other live adapters exist. See `packages/providers/src/adapters/*`. |
| Multi-platform Provider capability | Complete | The manifest/router model supports a Provider with independent capability and priority per platform. DLPanda exercises it. See ADR-0012 and adapter/router tests. |
| Provider capability evidence status | Complete | `unverified`, `fixture_verified`, `canary_failed`, `canary_verified`, and `delivery_verified` are enforced; delivery modes require `delivery_verified`. See ADR-0014, Provider schemas/tests. |
| Provider HTTP boundary | Complete | Bounded text bodies, exact HTTPS hosts, manual bounded redirects, scoped cookies, content-type validation, challenge mapping, and timeouts exist. See `packages/providers/src/http.ts` and adapter tests. |
| Provider normalization | Complete | Provider-specific HTML/payload details remain inside adapters and are converted to normalized resolutions/candidates. See `packages/providers/src/adapters/*`, `packages/providers/test/site-adapters.test.ts`. |
| Error taxonomy | Complete | Terminal, retryable, fallback, capability, integrity, and access-friction decisions are typed and tested. See `packages/providers/src/errors.ts`, Router tests. |
| Sequential bounded fallback | Complete | Attempts are sequential, deadline- and count-bounded, terminal-aware, and persist a sanitized ledger. See `packages/providers/src/index.ts`, `packages/providers/test/provider-router.test.ts`, Worker persistence. |
| Provider deployment enable/disable | Operator only | Adapter registration/approval is environment-driven and requires restart; production mock startup is rejected. Runtime pause/deny is separate. See `apps/worker/src/providers.ts`, `.env.example`. |
| Scheduled Provider canaries | Backend only | A singleton scheduled service, exact Provider pinning, one-attempt routing, gates, and persistence exist. Deployment/scheduling and a complete X tuple list are not established. See `apps/canary/src/index.ts`, `packages/providers/src/canary.ts`, `config/provider-canaries.json`. |
| Canary success/failure and latency | Backend only | Status, failure class, duration, format count, attempt/fallback data, and tuple dimensions are persisted and available to protected diagnostics. See migration `0008_canary_measurements.sql` and Canary repository/tests. |
| Format observations | Partial | Canary stores a bounded format count, not a durable per-format compatibility history. See Canary measurement contracts and persistence. |
| Link-lifetime observations | Partial | The stored lifetime is candidate expiry horizon. The scheduled Canary does not re-HEAD a media URL after elapsed time, so this is not observed upstream availability. See `apps/canary/src/index.ts`, canary tests. |
| Delivery outcomes | Backend only | Privacy-safe ticket/redirect validation outcomes and daily aggregates exist. Redirect issuance is not proof of a completed browser download. See `apps/delivery/src/index.ts`, `packages/pilot-evidence/src/index.ts`, migration `0010_pilot_evidence.sql`. |
| Region-dimensional evidence | Complete | Attempts, circuits, canaries, guards, route policies, and evidence use Provider/platform/region tuples. See migrations `0004`, `0008`-`0012` and related packages. |
| Circuit breakers and health aggregation | Complete | Durable attempt aggregation, categorized failures, sample/freshness gates, p95 latency, Redis projections, and half-open leases exist. See `packages/provider-health/src/index.ts`, ADR-0006, tests. |
| Qualification lifecycle and calibration | Backend only | Persistence and methods for calibration proposals, review, and policy locking exist, but no normal graphical qualification/promotion workflow is exposed. Some operations are verification/direct-repository oriented. See ADR-0008, `packages/pilot-evidence/src/index.ts`, migration `0010_pilot_evidence.sql`. |
| Automatic restrictive controls | Complete | Evaluator/guard can hold, reduce, deny, or mark recovery eligibility but cannot grant or raise traffic. See `apps/evidence-evaluator/src/index.ts`, `packages/pilot-guard/src/index.ts`, ADR-0008. |
| Percentage rollout | Complete | Deny-first audited rollout rules and deterministic first-choice traffic shares exist; traffic shares do not fan out. See `packages/rollout-control`, `packages/route-policy`, ADR-0007/0014. |
| Region-aware runtime routing | Complete with blocker | Router enforces concrete region eligibility. The mechanism works, but checked-in NL configuration currently has no eligible deliverable X Provider. See Router and manifests. |
| Emergency deny/resume | Complete | Admin commands publish exact-scope deny and can only resume the same Admin-created deny; they cannot grant traffic. See Admin API route controls and rollout-control tests. |
| Runtime policy distribution | Complete | PostgreSQL is authoritative; versioned expiring Redis snapshots use revision/CAS semantics and safe fallback behavior. See `packages/route-policy/src/index.ts`, migrations `0011`/`0012`/`0018`. |
| Routing audit trail and rollback | Complete | Immutable revisions, receipts, bounded actor/reason metadata, optimistic concurrency, publish/propagation state, and rollback-as-new-revision exist. See Admin contracts/persistence and route-policy tests. |
| Safe redirect delivery | Complete | Encrypted candidates, hashed one-use tickets, expiry, exact media-host policies, redirect/DNS validation, and no media-body fetch are implemented for the two X Providers. See `apps/delivery`, `packages/delivery`, migration `0003_delivery_candidates.sql`. |
| Proxy or temporary-file delivery | Planned | The contracts/ADRs allow future delivery modes, but current production policies and implementation are redirect-only. |
| Graphical owner Admin | Complete | A password-authenticated Next Admin and loopback Admin API exist; this is not a read-only prototype. See `apps/admin`, `apps/admin-api`, ADR-0011. |
| Admin account security | Complete | Single Postgres account, scrypt, Redis sessions/rate limits, HttpOnly same-site cookie, CSRF/origin proof, password change and session revocation exist. See migration `0016`/`0017`, Admin auth sources/tests. |
| Admin Provider routing controls | Complete | Platform-first capability view, order, traffic shares, staged allocation, concurrency caps, pause/deny/resume, Probe, preview, publish, rollback, and conflicts are graphical. See Admin route components and `apps/admin-api/src/services/routes.ts`. |
| Admin Provider qualification controls | Partial | Health/circuit/canary/evidence projections are visible, but calibration/policy locking and qualification stage promotion are not a complete graphical operator flow. |
| Admin platform management | Partial | Labels, visibility, page association, drafts, publish, rollback, and readiness are editable. Host rules, catalog lifecycle, and Provider capability intentionally remain code-owned. See Admin platform services/components, ADR-0010/0012. |
| Locale/content CMS | Complete | BCP 47 locale registry, structured page/shared-content revisions, preview, immutable snapshots, publish acknowledgement, retry, and rollback exist. See `packages/admin-contracts`, migrations `0014`/`0015`, Admin content UI. |
| Public locale routing | Partial | Dynamic locale routes and published content exist, but bundled seed content is only `en`/`zh-CN`; general UI chrome falls back to English except for `zh-CN`. See `apps/web/app/[locale]/[[...slug]]/page.tsx`, Web content loader. |
| Platform landing pages | Backend only | Code-owned page definitions, CMS fields, route rendering, and eligibility gates exist, but the repository seed publishes only the two homepages and no platform is stable/index-eligible. |
| Metadata/canonical/robots/hreflang/sitemap | Complete | They are derived from the active snapshot with same-origin and eligibility validation. See Web page metadata, `apps/web/app/robots.ts`, `apps/web/app/sitemap.ts`, Admin SEO validation/tests. |
| Structured data | Partial | A code-owned structured-data template/passport model exists in Admin, but the public Web does not emit JSON-LD. Arbitrary JSON-LD editing is intentionally prohibited. |
| GEO-oriented content | Partial | Structured help/FAQ/how-to content fields are reusable, but no explicit GEO product model or rendered structured-data layer exists. |
| Stable-before-indexing gate | Complete | Platform pages require stable catalog state, eligible monitored production routing, and locale readiness. With zero stable platforms, none currently qualifies. See ADR-0010 and Admin/Web SEO tests. |
| Task/result non-indexability | Complete | Private/dynamic prefixes are excluded/disallowed; API responses and Admin use noindex headers, and public task states do not create indexable result URLs. See `robots.ts`, sitemap logic, API response headers, AGENTS.md. |
| Production deployment and schedules | Missing | Repository Docker Compose provisions PostgreSQL/Redis only; application deployment and recurring service schedules are not represented as deployable infrastructure. |
| Live production readiness evidence | Missing | Three-day calibration, locked policy, seven daily reviews, and staged live proof are absent. See `config/x-pilot-evidence.json`. |

## 4. Product-gap analysis

### Multiple third-party Providers

Reusable: the Provider interface, runtime manifest, capability matrix, exact platform/region
filtering, candidate validation, sequential fallback, error taxonomy, rollout/health gates, and
deterministic traffic shares are complete. The X route already uses two real adapters.

Gap: every additional Provider still needs an adapter, explicit page and media host policy,
fixtures, error decisions, platform capability evidence, reviewed region scope, delivery audit,
authorization, and live qualification. Admin cannot and should not create executable Provider
capabilities.

### Multiple supported media platforms

Reusable: dynamic slugs, explicit host recognition, canonicalization, task/queue/Worker plumbing,
per-platform Provider priorities, normalized results, Admin capability matrix, CMS page definitions,
and SEO eligibility are platform-generic.

Gap: 41 catalog entries are only planned and the three experimental entries are not stable. DLPanda
is resolution-only, so catalog breadth currently exceeds deliverable Provider breadth. The API also
accepts recognized planned platforms before proving an eligible production Provider; users can
therefore receive an asynchronous failure for a catalog-known but operationally unsupported URL.

### Scheduled Provider health checks

Reusable: scheduled singleton execution, exact tuple authorization, Provider pinning, measurement
persistence, protected diagnostics, circuits, evidence aggregation, and cleanup exist.

Gap: production deployment/scheduling is absent, the configured X set omits SSSTwitter, and the
current link-lifetime field is inferred from expiry rather than measured availability. A product
decision is needed before adding more intrusive media checks because delivery safety and upstream
request boundaries would change.

### Safe automatic degradation and fallback

Reusable: circuit opening/half-open probing, restrictive guards, emergency deny, concurrency,
bounded deadlines, deterministic first choice, and sequential terminal-aware fallback are already
implemented.

Gap: actual effectiveness depends on correct region declarations, live rollout rules, current
evidence, deployed Redis/PostgreSQL, and running evaluators. Those operational prerequisites are
not proven by source code.

### Administrative Provider/platform management

Reusable: the Admin already offers a capability matrix, route previews, state projections,
platform presentation configuration, and bounded technical Probe.

Gap: Provider qualification/calibration is not fully productized in the UI. Platform host rules,
capabilities, delivery modes, and catalog lifecycle correctly remain code-reviewed. The roadmap
should describe those as controlled engineering changes, not missing CRUD screens.

### Administrative routing configuration

Reusable: ordering, first-choice shares, staged allocation, concurrency caps, publication,
propagation receipts, rollback, emergency deny, and resume already exist graphically.

Gap: the UI cannot repair a code-owned region/capability mismatch and cannot replace the missing
live qualification evidence. Operational status also depends on deployment wiring that is not in
the repository.

### Per-platform landing pages and editable content

Reusable: fixed platform-page schemas, locale registry, structured editor, preview, immutable
publication snapshots, Web rendering, redirect safety, and recovery exist.

Gap: no platform page is present in the bundled seed, no platform is stable, and actual production
database drafts/publications are unknown. More locale-specific interface copy will be needed for a
fully multilingual experience beyond English and Simplified Chinese.

### SEO metadata and GEO-oriented structured content

Reusable: editable safe SEO fields plus derived canonical, hreflang, robots, sitemap, and eligibility
logic exist. Structured FAQ/how-to content fields can support future answer-oriented pages.

Gap: the public Web does not emit JSON-LD, and the product has no explicit GEO content domain,
citation/source model, or quality workflow. Any structured-data addition must remain code-owned and
derive only from validated published fields.

### Stable-platform eligibility before indexing

Reusable: the exact gate already exists.

Gap: it cannot pass today because no catalog platform is stable. That is correct fail-closed
behavior, not an SEO bug. Promotion needs production delivery and monitored route evidence first.

### Example: what adding Instagram would require

Instagram already has a planned catalog entry, explicit `instagram.com` host recognition,
canonical URL processing, extractor identifiers, and host/spoof tests. The following architecture
can be reused unchanged: API task submission, queue schema, Worker platform re-recognition, Router,
attempt persistence, normalized public result, internal delivery candidates, Admin capability and
content views, locale publication, and SEO gates.

Platform-specific work is still substantial:

- select and authorize at least one Instagram-capable Provider;
- implement its adapter and explicit HTTP boundaries;
- add the Manifest capability, platform priority, verification status, and reviewed regions;
- add deterministic success/error fixtures and normalization tests;
- audit a safe delivery mode and exact media-host policy;
- add an authorized exact canary tuple and validate current URLs without challenge bypass;
- qualify the Provider/platform/region route, configure bounded rollout, and collect evidence;
- prepare reviewed localized content, then promote catalog lifecycle only after production evidence;
- publish/index the landing page only after the existing stable eligibility gate passes.

No public OpenAPI change is required for a normal normalized Instagram resolution. An ADR is
required only if the work changes persistence, task states, Provider selection semantics, or media
delivery mode/boundaries.

## 5. Duplication risks

Future product requests should not rebuild the following as new systems:

- **Provider registry/capability matrix:** already code-owned, runtime-validated, and visible in
  Admin. A database CRUD registry would create a second security authority.
- **Priority and fallback engine:** already platform-aware, sequential, bounded, terminal-aware,
  health-aware, and supports explicit Admin order.
- **Load distribution:** deterministic per-task first-choice shares already distribute eligible
  traffic without parallel Provider calls.
- **Health checks and circuit breakers:** scheduled canaries, durable measurements, circuit
  aggregation, half-open leases, and restrictive guards already exist.
- **Rollout/kill switch:** percentage grants, automatic caps, emergency deny, propagation, receipts,
  and rollback are already implemented.
- **Administrative site:** a real authenticated mutable owner console exists; it is not merely a
  read-only mockup.
- **CMS and localized publication:** structured revisions, locale registry, immutable snapshots,
  preview, publish, retry, and rollback already exist.
- **SEO page framework:** route rendering, metadata, canonical, hreflang, robots, sitemap, and
  eligibility are already driven by the published snapshot.
- **A second platform enum:** catalog slugs are intentionally dynamic and explicit host rules are
  the recognition boundary.
- **A public direct-link API or generic media proxy:** both would violate the existing Delivery
  boundary and expose upstream capabilities.
- **A compliance/audit product:** command/revision history is already the necessary technical safety
  record for a single-owner site; a multi-user approval center is outside the current product.

## 6. Architectural constraints

Future roadmap work must preserve these repository invariants:

1. Web, API, Worker, Provider resolution, Delivery, and Admin/control-plane boundaries remain
   decoupled.
2. Provider-specific fields and payloads stop at `packages/providers` and normalize through
   `@tikdd/contracts`.
3. Platform IDs remain catalog slugs with explicit reviewed host rules and spoofed-host tests.
4. Provider capability, platform priority, delivery modes, region eligibility, HTTP hosts, and
   credentials remain code/secret-owned Manifest boundaries; Admin may only narrow them.
5. Fallback remains sequential, bounded, and terminal-aware; traffic shares must never fan out a
   user request.
6. Submitted URLs and upstream responses are untrusted. Provider and Delivery networking remains
   HTTPS-only, allowlisted, redirect-bounded, and private-network safe.
7. Public resolve results never contain upstream URLs, delivery credentials, Provider payloads, or
   required upstream headers.
8. Delivery never becomes a general-purpose proxy. Every Provider/mode requires a reviewed host
   policy and redirect validation.
9. PostgreSQL remains durable authority for tasks and control revisions; Redis remains a replaceable,
   expiring projection/coordination layer.
10. Rollout grants are the only controls that can raise traffic. Automated guards can only hold,
    reduce, deny, or mark recovery eligibility.
11. Qualification, catalog status, rollout permission, circuit health, delivery safety, and SEO
    eligibility remain independent gates.
12. Admin mutations retain owner authentication, same-origin/CSRF checks, idempotency, exact scope,
    expected revision, and authoritative post-action verification.
13. Public Web reads complete immutable published snapshots and never depends on Admin API
    availability or exposes drafts.
14. Task, result, Admin, API, Delivery, and other private/dynamic paths remain non-indexable and out
    of sitemaps.
15. Only stable, deliverable, monitored, localized platform pages may be indexed.
16. Mock/failure-injection Providers remain development-only and refuse production startup.

## 7. Candidate roadmap impact

This section deliberately uses broad buckets only; it does not set priorities or Work Item numbers.

### Existing capability needing productization

- Turn backend qualification/calibration/review primitives into a coherent owner journey.
- Explain platform support truthfully across catalog recognition, resolution-only capability,
  delivery qualification, route health, and public availability.
- Surface the difference between inferred candidate expiry and actually observed link availability.
- Improve operational readiness explanations around scheduler, policy freshness, and deployment
  region compatibility.

### Existing capability needing Admin UI

- Qualification stage, calibration proposal, policy lock, evidence sufficiency, and promotion/hold
  decisions.
- More explicit deployment-region versus Manifest eligibility diagnostics.
- Scheduled-canary coverage gaps and last-run/freshness presentation.
- Content translation completeness and locale-specific interface-copy readiness.

### Extension of existing architecture

- Additional Provider adapters and per-platform capabilities.
- Additional reviewed regions and deployment-specific policies.
- Platform lifecycle promotion based on evidence.
- More locale packs and eligible platform pages.
- Code-owned JSON-LD templates derived from validated published content.

### New product domain

- A formal GEO/answer-engine content model, source/citation workflow, and quality evaluation.
- Rich platform compatibility/limitations guidance beyond the existing structured page fields.
- End-user download-completion measurement, if desired and if a privacy-safe definition can be
  established.

### New infrastructure

- Reproducible application deployment for the selected NL environment.
- Recurring scheduler/process supervision for Canary, evidence evaluator, and cleanup.
- Deployment monitoring/alerting and backup/restore evidence outside application-level controls.
- Optional future proxy or temporary-object delivery infrastructure; current redirect delivery does
  not provide it.

### Requires ADR

- Any new delivery mode, proxy behavior, temporary media storage, or broader network boundary.
- Any persistence or task-state change.
- Any change to Provider selection, fan-out, retry, or fallback semantics.
- Any change that makes catalog/platform state runtime-authoritative.
- Any end-user telemetry that adds identifiers, URLs, media metadata, or download-completion data.
- Any arbitrary structured-data/content execution surface or expansion beyond fixed safe schemas.

## 8. Recommended rebaseline checkpoint

The safest existing code checkpoint is **`main` at merge commit `416c0f1`**. It contains the merged
Work Item 13 generic capability-evidence and deterministic traffic-distribution baseline, including
the follow-up cross-platform verification fix, and was clean and aligned with `origin/main` at the
start of this audit.

The revised roadmap should begin from that exact commit plus a documentation-only commit containing
this audit after repository checks pass. A tag such as `rebaseline-2026-08-30` may be created after
that documentation commit is reviewed; this audit does not create the tag, change branches, or
modify runtime state.

This is an **engineering rebaseline**, not a declaration of production readiness. The first
checkpoint review must preserve the unresolved Work Item 11 evidence debt and the NL region
contradiction as explicit blockers rather than silently carrying forward `ready` terminology.

## Audit limitations and unresolved uncertainties

- No live Provider, media, or production endpoint was contacted.
- The NL deployment, Nginx/Cloudflare configuration, running processes, scheduler, secrets, and
  external monitoring were not available as repository evidence.
- Current production PostgreSQL/Redis contents are unknown, including active rollout rules,
  qualification policies, Admin route policies, guard/circuit snapshots, and published content.
- Repository seed content proves only the fallback `en` and `zh-CN` homepages; it does not prove
  what an external production database has published.
- Provider terms/production approval are represented by checked-in boolean assertions and opaque
  references; this audit did not independently verify external agreements.
- Real upstream behavior, challenge incidence, link lifetime, and browser download completion were
  not re-tested.
- `apps/admin-api/README.md` still contains Cloudflare Access wording that conflicts with ADR-0011
  and the implemented password authentication. Runtime code and ADR-0011 are treated as current;
  the README is documentation drift.
- Canary `linkLifetime` semantics are based on candidate expiry metadata, not a delayed network
  observation. Product copy and future metrics must not overstate it.

## Evidence inventory

The audit reconciled the following source groups:

- repository instructions and plans: `AGENTS.md`, `README.md`, `docs/development-plan.md`, Work Item
  11-13 implementation documents;
- architecture: `docs/architecture/README.md`, ADR-0002 through ADR-0014, with emphasis on
  ADR-0004 through ADR-0014;
- contracts and API: `packages/contracts`, `packages/admin-contracts`, `openapi/tikdd.yaml`,
  `apps/api`;
- platform/provider/routing: `packages/platform`, `packages/providers`, `packages/route-policy`,
  `packages/rollout-control`, `packages/admission-control`, `apps/worker`;
- delivery/health/evidence: `apps/delivery`, `packages/delivery`, `apps/canary`,
  `packages/provider-health`, `packages/pilot-evidence`, `packages/pilot-guard`,
  `apps/evidence-evaluator`, `apps/cleanup`;
- control and public product: `apps/admin`, `apps/admin-api`, `apps/web` and their tests/READMEs;
- persistence/configuration: all SQL migrations `0001` through `0018`, `config/*.json`,
  `.env.example`, and Docker infrastructure;
- verification/history: package/application test suites, scripts, `.github/workflows/ci.yml`, and
  recent Git history through `416c0f1`.
