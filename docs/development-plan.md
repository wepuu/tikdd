# TikDD development roadmap

- Rebaseline source: [`docs/project/current-state-audit.md`](project/current-state-audit.md)
- Repository checkpoint: `main@4256ca5f6358e8825d9dd6fec611287dce9935a9` (Work Item 35 merge)
- Roadmap revision date: 2026-09-10

This roadmap starts from the audited repository state, not from historical completion labels. TikDD
already has the core Provider, routing, health, rollout, Delivery, Admin, CMS, locale, and technical
SEO architecture. Future work extends or productizes those systems. It does not recreate them.

The public X and Instagram Betas are live through SSSTwitter, SaveFromIns, and Delivery. Work Item
26 is closed after a successful post-CI re-test on the supplied public Reel: GitHub-built images,
the full-allocation Instagram rule (revision 13), a non-zero MP4 transfer, and a clean 15-minute
watch are recorded in its closeout. Work Item 22 completed the earlier Instagram qualification with
two real browser downloads and a clean 15-minute watch. Work Item 22.1 shipped reviewed result
thumbnails with the existing platform-icon fallback from `main@c3fbd217` on 2026-09-08. ADR-0020
replaces elapsed calibration and evidence prerequisites with a lightweight release loop: PR CI,
GitHub-built immutable images, backup, one real browser download, a short health watch, and fast
rollback. X and Instagram remain experimental rather than `stable`. Work Item 23 is merged and deployed from
`main@177775c9193f3699ddfcb96c962b9df23ca193aa`; it provides a reviewed,
bilingual Instagram landing page for content review; it is deliberately noindex and absent from
the sitemap/hreflang group until the existing eligibility gate passes. Work Item 24 and Work Item
25A are implemented, merged, and deployed in the current production lineage. Work Item 25B is
implemented and deployed as bounded bilingual GEO seed content; its reviewed Admin publication is
still a separate on-demand operation. PR #64 (`main@13a56f28`) added SaveFromIns sparse-resource
compatibility. Work Item 27 is merged and deployed. Work Item 28 is merged and deployed from
`main@bdf6543a`; it preserves client-direct media delivery while bounding SaveFromIns retries and
adding a safe browser filename hint without starting Admin or calibration. Work Item 29 retains
SaveFromIns as the usable Instagram Beta and pauses paid replacement research. The private Admin
Beta operations view and its UI closeout are merged in Work Item 31. Work Item 32 completed the approved
on-demand NL preview: the owner logged in through `admin.tikdd.cc`, inspected the read-only Beta view,
and Admin was stopped afterward. Admin remains an on-demand, stopped production profile. Work Item 33
addresses the release-script executable bit and stage-gate false positives found during that preview.

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

### Current production baseline

- X Public Beta is live from GitHub-built immutable images.
- The SaveFromIns/Instagram/NL rule is revision 13, enabled at full allocation after the
  2026-09-09 closeout; its three runtime gates are true and the pilot guard is false.
- The exact SSSTwitter/X/NL rollout rule is enabled at full allocation with circuit monitoring and
  an emergency deny path.
- Historical Work Item 22 qualification proved real X and Instagram resolve, delivery-ticket, and
  non-zero browser transfers. The PR #64 smoke and the first Work Item 26 attempt are retained as
  failure history; they do not describe the current rollout state.
- The Work Item 22.1 release returned a reviewed Instagram thumbnail as `200 image/jpeg` with a
  non-zero 48,905-byte body and no redirect; all six core containers remained healthy with zero
  restarts during the 15-minute observation.
- The Work Item 23 release returned HTTP 200 for both localized Instagram Beta routes, retained
  `noindex`, and passed one real X download, one real Instagram download, and a 15-minute
  post-deploy watch with zero core-container restarts and zero observed API/Delivery 5xx.
- `config/x-pilot-evidence.json` remains truthfully `pending`; it is optional diagnostic evidence.
- Admin and the calibration profile remain intentionally stopped.

### Work Item 26 current status

Work Item 26 is complete. The fail-closed Worker guard remains in place, while the exact
SaveFromIns/Instagram/NL rule is enabled at revision 13 and full allocation after an explicit
authorization. The closeout records a `video/mp4` response with 4,476,966 non-zero bytes and a
15-minute healthy observation. The earlier candidate-lifecycle and timeout failures remain useful
diagnostics, not release blockers.

### Work Item 27 current status

Work Item 27 adds only lightweight operability: provider-neutral retry/unavailable/expired copy in
Web and a read-only `pnpm beta:report` aggregate over public X/Instagram tasks, attempts, and
delivery outcomes. It creates no migration, endpoint, telemetry stream, or always-on service. Admin,
calibration, and other Providers remain off. The next release still follows the fixed loop of
targeted tests, PR CI, GitHub images, backup, deployment, one real download, short observation, and
fast rollback. It is merged and deployed from `main@e462914`.

### Work Item 28 current status

Implementation and production proof are complete on `main@bdf6543a0e3c7fced09dc7b309616251d5f111f1`.
The one-use Delivery redirect keeps media bytes between the reviewed Provider CDN and the user's
browser. The filename hint is best effort because a cross-origin CDN may choose the final name.
SaveFromIns/Instagram remains bounded to two queue attempts; only network, timeout, and 5xx failures
may consume the second attempt. Internal diagnostics remain sanitized and no database migration or
public endpoint was added. The six core containers were healthy with zero restarts during the
15-minute post-deploy watch, and one real X plus one real Instagram browser download returned
non-zero media. Admin, calibration, X behavior, and other Providers remain unchanged.

### Work Item 29 current status

SaveFromIns remains the owner-approved, usable Instagram Beta Provider. The seven-day read-only
report (15/29 Provider attempts, 51.72%; 37/41 Delivery outcomes, 90.24%) is retained as an
operational signal, not an automatic release blocker. Paid replacement candidates are paused. Future
free candidates supplied by the owner will be screened one at a time under the existing public-only,
no-cookie, no-challenge-bypass and redirect-only rules. See the [Work Item 29 record](work-item-29-instagram-provider-replacement-feasibility.md).

### Work Item 30 current status

Work Item 30 is merged in the current main lineage: it adds a sanitized, authenticated Admin Beta health view
backed by the existing read-only persistence aggregation. It shows bounded X/Instagram task,
Provider-attempt, and Delivery summaries for 24-hour and 7-day windows without adding a migration,
public endpoint, Provider capability, or traffic control. See the [Work Item 30 record](work-item-30-admin-beta-operations.md).

### Work Item 31 current status

Work Item 31 closes the Admin UI pass for the Beta view and is merged by PR #69 in
`main@3eedddb8`. `Beta 健康` now sits inside the existing 运行 navigation, the panel uses
consistent operator-facing Chinese copy, and malformed legacy aggregate fields fail safe instead
of crashing RouteInspector. Desktop and 390px mobile layouts were reviewed against the existing
design tokens, and CI passed. Admin remains stopped in production. See the [Work Item 31 record](work-item-31-admin-beta-preview.md).

### Work Item 32 current status

Work Item 32 is complete after the approved owner-only preview on 2026-09-10. The GitHub-built Admin
image `ghcr.io/wepuu/tikdd-release-admin@sha256:4da7f14f51f0cad6a8ca9696d894b36ce4ed59c7ad969fd36540a7821d682629`
started alongside the Admin API; `https://admin.tikdd.cc/login` returned 200 with no-store/noindex
security headers, the `solo` account authenticated, and the read-only Beta health view rendered.
Admin API remained loopback-only (`127.0.0.1:3301` publication for the shared UI namespace; internal
4100 was not published). After the preview, both Admin containers were stopped and the public route
returned 404; the six core containers remained healthy and X/Instagram rollout state was unchanged.

The first `admin-start` command exposed a stage-gate contract mismatch (the host gate still expected
Admin 404 while on demand) and the stop check exposed that stopped Admin health state must be ignored.
These are recorded for Work Item 33 and are not Provider or application failures.

### Work Item 33 current status

Work Item 33 is merged and deployed from `main@8218b56881f847e6b3abd9acbd846bbc5dc55e6b`. The
production release script is executable, passes an explicit Admin expected-status contract to the
host gate, and cleans up the Admin pair when startup or the on-demand gate fails. The release used
GitHub-built immutable images, an encrypted PostgreSQL backup, a host-gate hash update, and a clean
15-minute health observation; Admin was stopped again after the approved preview. See the [Work Item
33 record](work-item-33-admin-lifecycle-gate-fix.md).

### Work Item 34 current status

Work Item 34 is merged in `main@4256ca5f6358e8825d9dd6fec611287dce9935a9` and deployed with the
current production lineage. This is a read-only Admin
operability slice: the Beta view adds a 1-hour window, per-platform latest activity timestamps, and
a cadence signal derived only from persisted aggregates. The signal distinguishes normal, observe,
cooldown-suggested, insufficient-data, and no-recent-event states; it never claims an exact upstream
cooldown and never sends a Provider request. SaveFromIns diagnostics now classify raw abort/timeout
errors as `provider_timeout` while preserving the existing Router retry policy. No migration,
rollout, gate, Provider capability, or production profile change is included. See the [Work Item 34
record](work-item-34-admin-provider-cadence.md).

### Work Item 35 current status

Work Item 35 is merged in `main@4256ca5f6358e8825d9dd6fec611287dce9935a9` and deployed as a follow-up to the
read-only cadence view. Admin now has an explicit server-enforced write scope: `readonly` (the
default, including when production configuration omits the setting), `content-draft` (locale/page/
shared-content drafts only), and `full` (the existing route, platform, qualification, publication,
and recovery commands). The Admin UI mirrors the scope, keeps safe content proofing available in
`content-draft`, and disables publication/retry/rollback until `full` is explicitly selected. This
slice adds no migration, Provider request, rollout/gate change, or production profile start. See the
[Work Item 35 record](work-item-35-admin-content-draft-mode.md).

### Stage 1 current status

Stage 1 is implemented and committed locally on `codex/stage1-admin-integrations` at `10ff503`,
pending PR/CI and separate production approval. It adds code-owned Google Analytics and Google AdSense
identifiers to the existing shared-content draft and immutable publication flow. The values are
disabled by default, editable in `content-draft`, and rendered by Web only after publication. This
stage does not add a public endpoint, arbitrary script editor, Provider request, rollout change,
calibration profile, or permanent Admin process. See the [Stage 1 record](stage-1-admin-integrations.md) and
[ADR-0028](architecture/adr/0028-code-owned-google-site-integrations.md).

## Coordinated future lanes

The lanes may progress concurrently only where their gates permit. Lane B can productize existing
operations while Lane A gathers evidence. Lane C can prepare non-indexable content and feasibility
research, but production activation and indexing remain downstream of Lane A and platform-specific
qualification.

### Lane A — Production Foundation

Primary objective: operate and improve the X Beta without weakening Manifest, Delivery, rollout,
or network safety boundaries.

This lane owns:

- Provider/deployment region consistency;
- exact SSSTwitter/X scheduled Canary coverage;
- reproducible application deployment;
- recurring Canary, evaluator, and cleanup supervision;
- real deployment preflight and backup;
- GitHub-built immutable production images;
- one real browser delivery journey per release;
- short post-deploy health observation and fast rollback.

Additional platforms remain separate small work items and require their own Provider and delivery
review. X remains Beta until real usage supports a later stability decision.

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
during the initial rollback-confidence period. P0-DR-01's encrypted off-host PostgreSQL backup and
isolated restore drill are complete and recorded in
[`docs/p0-dr-01-backup-restore.md`](p0-dr-01-backup-restore.md). Scheduling, retention and recurring
restore testing remain a later reviewed operational decision.

Phase C2 is gated separately: Gate A prepares containers, Gate B proves shared-host coexistence,
Gate C performs Tunnel/Nginx ingress cutover while retaining the legacy TikDD rollback path, and
Gate D stops only proven legacy-TikDD-exclusive resources. None of these gates grants Provider
traffic or starts Work Item 17.

Phase C2 status (2026-08-31): Gates A, B and C passed on the approved NL host. TikDD Web, API and
Delivery are live through the dedicated `tikdd-nl` Cloudflare Tunnel and loopback-only Nginx origin.
`https://www.tikdd.cc` is canonical; the apex permanently redirects while preserving path/query.
Admin remains stopped and unpublished, all Provider/rollout/Canary gates remain disabled, and the
unrelated PHP sites retain public 80/443. Work Item 16's deployment-foundation implementation is
complete. Encrypted off-host PostgreSQL backup plus a proved restore remains P0 production
hardening and must be closed before production traffic is treated as fully recoverable.

P0 stabilization status (2026-08-31): the X production failure was classified as no eligible route
while the intentional Provider and rollout gates were closed; no adapter defect was evidenced. A
bounded Nginx migration for the historical `/i` family and an explicit legacy-slug allowlist passed
release validation.

P0-X-E2E-FINAL-VERIFY status (2026-09-03): complete. One owner-authorized production task traversed
X, SSSTwitter, normalized result persistence, encrypted redirect candidates, Delivery ticket
creation and one-use 302 browser handoff without CDN/media transfer. `P0-X-HTTP-01` is resolved
technically. X remains experimental/non-stable and is now released through ADR-0020's lightweight
Beta loop.

Work Item 17 status (2026-09-04): implementation and production recurring-run proof complete.
Host-owned systemd timers
invoke isolated Docker Compose one-shot wrappers for Canary, evidence and cleanup. The persisted
operational read model exposes last/next run, freshness, lease state and bounded failures; its
readiness verifier fails closed for missing, stale or failed state. Scheduled Canary authorization
is machine-restricted to `ssstwitter-x-recurring-001` in `canary-global`; public X allocation and
all Worker Provider flags were disabled at that checkpoint. Calibration remains an optional,
default-off diagnostic profile.

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

Status: implementation and production proof complete (2026-09-04). See
[`docs/work-item-17-scheduled-operational-services.md`](work-item-17-scheduled-operational-services.md)
for the implementation, production activation and recurring-run evidence.

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

Status: implemented, verified, and deployed to the NL production host on 2026-09-05. Admin remains
stopped and all public Provider rollout remains disabled. See
[the implementation record](work-item-18-qualification-admin.md).

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

Status: implementation, verification, and NL production deployment complete on 2026-09-05. The
dashboard adds no write path; Admin remains stopped and calibration, Provider production traffic,
and the public pilot remain unstarted. See
[the implementation record](work-item-19-operational-truth-dashboard.md).

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

## Optional X evidence operations

ADR-0017 through ADR-0019 remain implemented diagnostic tools for the exact SSSTwitter/X/NL tuple.
They have been deployed but the isolated calibration profile has not been started. Under ADR-0020,
calendar-length evidence is not a launch gate and must remain `pending` until actually observed.

The public Beta release gate is deliberately small: passing PR CI, immutable GitHub images, a
pre-deploy backup, one real resolve-and-download browser journey, healthy core services, and a
15-minute observation. Provider terms, delivery host validation, rollout control, admission,
circuit breakers, and emergency deny remain mandatory.

### Work Item 20 — Instagram Provider feasibility

Lane: B with Lane C preparation. May run during the X evidence window, but cannot enable Instagram
production traffic, stable promotion, or indexing.

Status: complete with one technical candidate on 2026-09-06. DLPanda was rejected after owner
testing confirmed that it does not provide a usable Instagram path for TikDD. `reelsvideo.io`
required Cloudflare Turnstile and returned HTTP 429 to both the synthetic and reviewed real-sample
probes. The later candidate `savefromins.com` resolved the first reviewed public Reel without a
login or interactive challenge and its direct Instagram CDN candidate passed a bounded public-DNS,
HTTPS, MP4, and Range check. Production use remains unapproved until its automated-use terms and
the variable Instagram CDN host policy receive an explicit review. No candidate was added to a
Manifest and no production state changed. See
[the feasibility record](work-item-20-instagram-provider-feasibility.md).

Evaluate authorized Provider candidates using exact reviewed test tuples. Cover adapter feasibility,
normalized errors, region behavior, delivery feasibility, challenge behavior, request bounds, and
commercial/technical constraints. Reuse the existing platform catalog entry and Provider research
boundary. Do not add a generic extractor or treat yt-dlp catalog presence as current availability.

Exit: an evidence-backed go/no-go and selected Provider/delivery approach, or a documented decision
that no safe candidate currently exists.

### Work Item 21 — Instagram Provider adapter

Lane: B.

Status: merged and deployed from `main@00bc4b9` on 2026-09-06 with all activation gates false and
zero Provider attempts. The `savefromins.com` adapter includes deterministic fixtures, normalization,
typed errors, bounded requests, NL-only routing, three fail-closed activation gates, and the
ADR-0021 reviewed `cdninstagram.com` subdomain policy. Production qualification and traffic remain
blocked until automated-use approval and a separate owner-authorized rollout. Do not adapt DLPanda
or `reelsvideo.io` around their current boundaries.

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

Lane: B, gated by Work Item 21 and an independently reviewed Instagram delivery path.

Status: complete. The initial authorized Phase B attempt failed closed, disabled the rollout before
the runtime gates, and identified the missing reviewed Meta FNA CDN family. ADR-0022 added the
versioned, label-boundary Delivery policy for `fna.fbcdn.net` while keeping the parent `fbcdn.net`
family denied. After that repair, both owner-supplied public Reels completed real browser downloads
and the route passed its 15-minute production observation. Instagram remains an experimental Beta,
not stable support.

Qualify exact Provider/Instagram/region tuples through targeted tests, rollout, Delivery outcomes,
circuit monitoring, and the ADR-0020 lightweight release loop. Calibration and longer evidence
windows remain optional diagnostics. Resolution-only proof may advance technical feasibility but
cannot qualify production download delivery.

Exit: the route has current reviewed delivery evidence and an operator-approved bounded rollout;
catalog promotion remains a separate product decision after the required observation window.

### Work Item 22.1 — Reviewed result thumbnails

Lane: B product repair.

Status: merged and deployed from `main@c3fbd217` on 2026-09-08. ADR-0024 permits only reviewed
exact-host X and Instagram result thumbnails and retains the platform-icon fallback. Production
smoke verified a reviewed Instagram image response with a non-zero body and no redirect; the six
core containers remained healthy with zero restarts during the 15-minute observation.

### Work Item 22.2 — Production support truth alignment

Lane: B product truth maintenance.

Align the platform catalog, homepage metadata, README, and roadmap with the live X and Instagram
Betas. Both platforms remain `experimental`; this work does not add an Instagram landing page,
change rollout, expand the sitemap, start Admin, or start calibration.

Exit: API catalog output reports Instagram as experimental, both homepage locales describe X and
Instagram, and the current roadmap points to Work Item 23 without changing SEO eligibility.

### Work Item 23 — Instagram landing page

Lane: C. Target public route: `/instagram-downloader/`.

Status: complete and deployed. The bundled fallback snapshot contains reviewed English
and Simplified Chinese platform content, and the public route renders the shared resolver, localized
steps, limitations, and FAQ through the existing structured page template. The SEO passport permits
an experimental platform page only when it is explicitly noindex; requesting indexability still
returns `platform_not_eligible`. The page is absent from sitemap and hreflang by derivation.

The normal production path remains content-editorial: create or revise the two locale cells through
the existing Admin structured editor, preview and publish one immutable snapshot, then separately
review the SEO passport. This work item does not start Admin, change Provider rollout, or promote
Instagram to `stable`.

Exit: reviewed localized content is publication-ready, and indexability is still derived rather than
manually asserted.

### Work Item 24 — Structured data foundation

Lane: C.

Status: implemented, merged, and deployed in the current production lineage. This increment adds
ADR-0025, a bounded template collection in the SEO passport, and a server-side JSON-LD renderer. It
does not change Provider rollout, start Admin, or make the Instagram Beta indexable.

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

#### Work Item 25A — Bounded GEO content foundation

Status: implemented and merged at `main@d8ba331471e1af2f8fcd716e597b0135ba3469a2`; deployed in
the current production lineage. The content remains subject to the separate on-demand Admin
publication step.

This first slice adds an optional, backward-compatible `geo` object to platform-page JSONB content,
with a concise direct answer, review state, review timestamp, and code-owned source references. It
adds an indexability blocker for unreviewed platform content, renders the answer and approved
sources visibly, and exposes only fixed source choices in Admin. It does not add a migration, start
Admin in production, change Provider rollout, or make the Instagram Beta indexable.

#### Work Item 25B — Instagram GEO editorial seed and publication

Status: implemented and merged by PR #63; deployed in the current production lineage. The bundled
seed is available for review, but no permanent Admin process or automatic publication is implied.

Populate the existing bilingual Instagram Beta pages with bounded, non-indexable GEO inputs using
the 25A contract. Reuse `limitationsMarkdown` for limitations, use only code-owned source IDs, keep
the content in draft until an owner review is actually performed, and keep localized labels valid.
This slice adds no schema or migration, does not start Admin permanently, and does not change
Provider, rollout, calibration, or stable-platform state. If the production database has an active
snapshot, publishing the reviewed content is a separate on-demand Admin operation followed by
stopping Admin again.

Exit: the bundled and reviewed content snapshots validate in both locales, the Instagram pages
render the direct answer and fixed sources while remaining noindex, and the existing download flow
is unchanged.

### Work Item 26 — Instagram Beta reliability closure

Lane: A with a bounded Provider decision; no new platform or SEO surface.

Status: closed after the post-CI production retest recorded in the Work Item 26 closeout. The
historical SaveFromIns adapter now tolerates sparse resources, while the later reliability follow-up
is tracked by Work Item 28. The original production smoke on 2026-09-08 did not produce a new
successful Instagram transfer: one supplied
URL was terminal `content_not_found` and a previously successful Reel returned `invalid_result`.
This is insufficient evidence for a reliability claim and does not justify widening the direct-media
mode or Delivery Host allowlist.

Scope:

1. Reproduce once with a currently public Reel that is verified in a browser, recording only the
   sanitized response shape and Provider attempt code.
2. If a trusted direct MP4 is present, add the exact bounded fixture and adapter/routing regression
   test. Keep the response count, timeout, retry, SSRF, redirect, and Delivery policies unchanged.
3. If no trusted direct MP4 is present or the Provider is challenged repeatedly, stop patching the
   adapter and open a separate Provider replacement feasibility item. Do not accept new download
   modes, runtime-discovered hosts, cookies, or challenge bypasses.
4. Release through the MVP loop: targeted tests, `pnpm check`, PR CI, GitHub immutable images,
   encrypted backup, manual deployment, one real Instagram transfer, and a 15-minute watch.

Failure handling is rule-first: if the real transfer or core health gate fails, set the exact
SaveFromIns/Instagram/NL rollout rule to `enabled=false` and `allocationBps=0` with CAS, then close
the three SaveFromIns gates. X remains unchanged. A version-wide failure is the only condition that
justifies rolling back the application image.

Exit: one current public Reel resolves to a direct MP4, Delivery returns a non-zero video response,
core services remain healthy with no material 5xx/circuit event, and the production record is updated
without claiming stable support. Until then, Instagram remains Beta and noindex.

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
