# TikDD development roadmap

- Rebaseline source: [`docs/project/current-state-audit.md`](project/current-state-audit.md)
- Repository checkpoint: `main@f5fc9a20b532487f432047dcc5480508f6e445a1` (Work Item 89 production operations closeout)
- Roadmap revision date: 2026-09-23

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
rollback. X and Instagram remain experimental rather than `stable`. Work Item 50 completed the
TikTok stability and sitemap promotion based on the successful natural-traffic closeout; it does not
change the X/Instagram status. Work Item 23 is merged and deployed from
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
- Admin remains available for the owner workflow; calibration remains intentionally stopped. Provider
  gates and rollout rules remain platform-specific and are changed only through an authorized release.

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

Stage 1 is merged through PR #73 and deployed in the current production lineage at
`main@96a4ad63792cba274387c4d2558a68f447083f09`. It adds code-owned Google Analytics and Google
AdSense identifiers to the existing shared-content draft and immutable publication flow. The values
are disabled by default, editable in `content-draft`, and rendered by Web only after publication.
This stage does not add a public endpoint, arbitrary script editor, Provider request, rollout change,
calibration profile, or permanent Admin process. See the [Stage 1 record](stage-1-admin-integrations.md)
and [ADR-0028](architecture/adr/0028-code-owned-google-site-integrations.md).

### Stage 2 current status

Stage 2 / Work Item 36 is implemented, merged in PR #74, and deployed from
`main@ac6bbee66e1bcb9b1cf6dd9ea27510198108b506`. The read-only Admin publication control room
derives its state from the existing content, SEO, settings, and immutable-publication read models.
It adds no new persistence model, public endpoint, Provider capability, rollout change, or permanent
Admin process. The GitHub-built Web, Service, and Admin images were verified against the merge SHA;
the six public core containers are healthy and Admin remains stopped. See the [Stage 2 record](stage-2-admin-publishing-center.md).

### Stage 3 current status

Stage 3 / Work Item 37 is merged and deployed from `main@f25c516c8dbdefc90a4f1cc72044e1360ab68003`.
It groups bilingual X/Instagram Beta content, a read-only Admin growth-readiness view, and a fixed
privacy-safe GA event catalog. It adds no Google reporting API, analytics database, Provider,
rollout change, calibration profile, media delivery mode, or permanent Admin process. X and Instagram
remain Beta/noindex and integration identifiers remain disabled until an owner publishes a validated
snapshot. See the [Stage 3 record](stage-3-growth-content-measurement.md).

### Stage 4 current status

Stage 4 / Work Item 38 is merged and deployed from `main@8f6eb9bb08196ece7ccb4601df2dd9a877c6bddf`.
It creates the first bilingual structured content set (homepage, FAQ, help, privacy, terms, X, and
Instagram) as code-owned starter data, exposes a read-only preview and idempotent Admin action that
creates only `ready` drafts before the first snapshot, and keeps publication behind the existing
`full` mode. Web fallback and Admin bootstrap share the same contracts. The release used GitHub-built
immutable images, an encrypted PostgreSQL backup, and a successful staged health gate; no Provider,
rollout, calibration, or permanent Admin process changed. See the [Work Item 38 record](work-item-38-content-bootstrap.md).

### Stage 5 current status

Stage 5 / Work Item 39 is complete. The owner-authorized on-demand session created and reviewed the
bilingual starter drafts, published the first immutable snapshot at `r1`, and received Web
acknowledgement for 16 changes across 14 paths. PostgreSQL/configuration backups were captured before
the session, the six core containers remained healthy with zero restarts, and Admin returned to
`readonly` and was stopped (public Admin route 404). Provider traffic, rollout, calibration, and
Delivery remained unchanged. See the [Work Item 39 record](work-item-39-first-content-publication.md).

### Stage 6 current status

Stage 6 / Work Item 40 is implemented locally on the current release line; its external release closure
is still handled through the normal approval flow. It hardens the Admin publication control room and
its production lifecycle without adding a new persistence or delivery path. The Admin UI uses the
authoritative content/publication/SEO read models for blocker counts, make the sequence
`内容就绪 → 发布前检查 → 部署确认 → 快照传播 → 公共读取` explicit, and show a clear disabled reason
for every unavailable publish action. Published `r1` with zero diff is shown as complete rather than as
an outstanding first-publication alert.

The official release script will accept an explicit expected Admin write mode, verify the running
container matches it, fail closed and stop Admin on mismatch, and provide a release-env-bound one-shot
account operation. `admin-stop` continues to verify the 404 route while leaving the six core services
untouched. Tests cover authoritative-versus-legacy status, idle/propagating/propagated/failed UI
states, mode mismatch cleanup, Compose validation, and the existing `pnpm check` gate. This batch does
not call SaveFromIns, change any Provider or rollout state, run calibration, alter indexability, or
start Admin in the production deployment path. See the [Work Item 40 record](work-item-40-admin-publication-ops.md).

### Stage 7 current status

Stage 7 / Work Item 41 is merged and deployed from
`main@c01da20954e398eb9f01e69808bcc8c5b72b49db`. It adds the lossless structured page editor for all
five code-owned templates (homepage, platform, guide, FAQ and legal), nested steps/FAQ/sections,
explicit draft discard, and a live preview. Existing SEO paths, noindex/sitemap policy, redirects and
social metadata remain protected. The owner-only Admin preview remains on-demand and production
Admin is stopped outside approved sessions.

### Stage 8 current status

Stage 8 / Work Item 42 is implemented locally on branch `codex/stage8-admin-simplification`. The Admin
console is reorganized into four focused workspaces—概览、内容、Providers、设置—while legacy anchors
continue to map to the correct workspace. Routine content, site settings and Google integration forms no
longer expose deployment/reason audit fields; the server command contracts still receive internal
reason, confirmation, revision and idempotency values. Provider route and qualification controls keep
their explicit safety confirmations. No persistence schema, Provider traffic, rollout rule, calibration
profile or production Admin lifecycle is changed in this batch. See the [Work Item 42 record](work-item-42-admin-workspace-simplification.md).

### Stage 9 / Work Item 43: Provider capability and routing foundation

The local Stage 9 batch adds a shared effective-route score/plan projection and a focused Admin
Providers view. It shows the bounded primary/fallback order and sanitised exclusion reasons without
probing a Provider or changing traffic. Future free-provider adapters still require isolated public,
no-cookie and no-challenge validation; SaveFromIns remains the current Instagram Beta provider and
no paid replacement is planned. See [ADR-0030](architecture/adr/0030-effective-provider-route-plan.md),
the [Work Item 43 record](work-item-43-provider-routing-foundation.md), and the
[Provider onboarding checklist](provider-onboarding-checklist.md).

### Stage 2 Provider expansion / Work Item 44: Free Provider portfolio and routing optimization

Work Item 44 is implemented locally on `codex/wi44-free-provider-portfolio`. It adds a code-owned,
offline qualification contract for free candidates and a bounded access-friction adjustment to the
shared effective route score. The adjustment is neutral without a health sample, cannot override a
deliberate Admin order or a large priority gap, and leaves sequential fallback, circuit breakers,
attempt limits, and rollout gates unchanged.

No new Provider was added because no new owner-supplied candidate passed review in this batch.
DLPanda remains resolution-only; SaveFromIns remains the current Instagram Beta and must not be
probed repeatedly. There is no live third-party request, database migration, public API, Host-policy
change, rollout change, calibration start, or permanent Admin process. See [Work Item 44 record](work-item-44-free-provider-portfolio.md)
and [ADR-0031](architecture/adr/0031-free-provider-intake-and-bounded-routing.md).

Exit requires an owner-supplied free candidate to pass the offline intake, deterministic fixtures,
explicit Host/redirect review, delivery verification (when applicable), and the existing CI,
GitHub-image, backup, deployment, and short-observation loop. Until then the current X/Instagram
production routes are unchanged.

### Work Item 45 current status

Work Item 45 adds the first disabled TikTok free-Provider adapter in the portfolio lane. The
accepted candidate is SnapTik Monster: one bounded probe returned a public, no-login/no-challenge
HTML result with an MP4 link on the exact reviewed `tikcdn.beubagah.com` host. The adapter is
fixture-tested, redirect-only, and guarded by independent terms and Delivery-audit flags. SSSTik is
deferred after an empty parse response; TTSave is deferred because its current flow starts a
server-side MP4 job; Collabstr is rejected as a non-resolution marketplace. No rollout rule,
production traffic, migration, X/Instagram change, or frequent live test is included. See the
[Work Item 45 record](work-item-45-tiktok-provider-batch.md) and
[SnapTik Monster Provider record](providers/snaptik-monster.md).

### Work Item 46 — TikTok Beta launch batch

Work Item 46 closes the current TikTok implementation as one stage-level release batch. It adds
the bilingual `/[locale]/tiktok-downloader` platform page, updates homepage/FAQ/help/legal copy and
metadata to identify TikTok as experimental, and extends the fixed GEO source registry. The page
remains `noindex`, outside sitemap/hreflang, and does not promote TikTok to `stable`.

The implementation is intentionally combined with the unpushed Work Item 45 branch so the owner
can authorize one PR, one GitHub-image build, and one production deployment instead of a sequence of
small releases. The SnapTik Monster adapter, exact Delivery Host policy, and independent gates stay
disabled until that deployment's explicit enablement step. X and Instagram rollout/gates remain
unchanged; Admin and calibration remain off.

Release proof is one currently public TikTok browser download followed by a 15-minute health watch.
No scheduled canary or repeated live probing is added because the free Provider may rate-limit
requests. After ten natural tasks, Admin aggregates determine whether SnapTik remains the TikTok
primary or a later free-Provider validation batch is needed.

See the [Work Item 46 record](work-item-46-tiktok-beta-launch.md).

### Work Item 47 — TikTok Beta launch readiness

The current production image is `main@cae65866c6391d7e703007481060d3d6f941bcc5`. X and
Instagram rollout/gates are unchanged, while SnapTik Monster and all TikTok provider gates remain
disabled. The deployed content snapshot predates the TikTok landing pages, so `/tiktok-downloader`
is currently a controlled Admin publication task rather than a live public route.

This stage-level batch makes the Admin read model include X, Instagram, and TikTok, accepts TikTok
as a privacy-bounded Web analytics platform, and lets the proofing desk prefill a missing code-owned
page from the reviewed starter record. The starter SEO contract is exact (`/tiktok-downloader`,
`noindex`, no sitemap/hreflang); existing revisions remain the write base and are never overwritten.
No migration, public upstream URL, provider activation, or new media path is introduced.

After PR CI and GitHub-image deployment, the owner may use Admin on demand to create the TikTok
`content-draft`, mark it ready, and publish one full snapshot. A separate production approval is
required before creating or enabling the unique `snaptik-monster / tiktok / nl` rule. Activation
proof is one real public TikTok download and a short health watch, followed by natural-task
observation in the Admin Beta aggregate. Repeated synthetic probing is intentionally avoided.

See the [Work Item 47 record](work-item-47-tiktok-beta-launch-readiness.md).

### Work Item 48 — SnapTik Delivery browser handoff

The failed TikTok activation produced successful Delivery ticket creation but no ticket redemption;
the tickets expired unused before the browser reached `/d/{ticket}`. Work Item 48 changed the Web
flow to create the one-use ticket and navigate the current tab in one user action. It was merged in
PR #82 and deployed from `main@5008685f2f50528ac1861e5b95c14d549013d1c1` using GitHub-built immutable
images. Delivery remains redirect-only, keeps its exact Host/DNS policy and 60-second ticket
boundary, and never transfers media bytes. The Web UI reports the handoff and requests a fresh
ticket for “download again” rather than reopening a consumed ticket. SnapTik, Admin, calibration, and other Providers remain
disabled pending the separate TikTok activation decision.

The change added SnapTik to the Delivery redirect matrix, tests opaque browser navigation, and
documents layered production acceptance. CI, the GitHub-image/backup deployment loop, and the
post-deploy health checks passed. The next action is one separately approved TikTok browser test;
no repeated Provider probes are planned. If the Delivery GET and 302 succeed but the CDN transfer
fails, SnapTik remains disabled and the next free-Provider feasibility item is opened.

See the [Work Item 48 record](work-item-48-snaptik-delivery-handoff.md).

### Work Item 49 — TikTok Beta closure and free-Provider expansion gate

Work Item 49 is complete. It published the bilingual TikTok snapshot and enabled the unique
`snaptik-monster / tiktok / nl` rule at revision 4 with `allocationBps=10000` after one approved
browser acceptance. Production records show successful task creation, Provider attempt, ticket
creation, redirect validation, and browser handoff; X and Instagram remain unchanged.

### Work Item 50 — TikTok stable promotion and sitemap publication

Work Item 50 promotes TikTok from `experimental` to `stable` after the owner confirmed successful
natural traffic. The sanitized production aggregate contains eight successful public TikTok tasks
(seven after the acceptance task) and no recorded SnapTik failures, with matching successful
Delivery outcomes. The code-owned bilingual TikTok pages now carry reviewed GEO content and are
eligible for `indexable=true`, reciprocal hreflang, structured data, and sitemap inclusion. X and
Instagram remain experimental/noindex. The corresponding SEO fields must still be saved and
published in one on-demand Admin session after the merged code is deployed; the active immutable
snapshot, not the source starter alone, controls the production sitemap.

The release keeps the current TikTok rollout and gates unchanged, does not run calibration, and does
not start Admin outside the publication session. Verification is limited to image provenance,
backup/deploy health, snapshot acknowledgement, localized metadata, sitemap paths, and preservation
of X/Instagram noindex boundaries. See the [Work Item 50 record](work-item-50-tiktok-stable-seo.md).

The next free-Provider feasibility batch now has an owner-supplied queue but is not part of the
Work Item 50 release. TikTok candidates are `tokvid.io`, `tikvid.cc`, `tikcd.com`, and `tikvid.io`;
Instagram candidates are `snapinsta.to`, `gramsnap.com`, and `savevid.net/en`. Work Item 51 records
the first offline screening result and keeps every candidate out of production rollout until its
fixtures, exact page/media Host policy, and Delivery verification pass.

The Web flow now performs the Delivery handoff in one browser action. After handoff it shows a
status message and a “download again” action that creates a fresh one-use ticket; it does not
render or reopen the consumed ticket. Natural-traffic evaluation has since passed and is closed by
Work Item 50, which promotes TikTok to stable and prepares the reviewed pages for sitemap
publication. The free-Provider batch remains a contingency for a future regression and evaluates
owner-supplied candidates behind disabled manifests until each passes fixtures, Host policy,
Delivery verification, CI, deployment, and one acceptance request.

### Work Item 51 — 免费 Provider 组合验证与二级路由

Work Item 51 is implemented on top of `main@9c0a259`. The offline candidate matrix covers the four
TikTok and three Instagram candidates supplied by the owner. TikVid.cc and SnapInsta.to have
fixture-backed, resolution-only adapters with exact provider-page allowlists and independent
activation gates. The remaining candidates stay in the code-owned intake matrix; SaveVid.net is
rejected because its public claims include private-content downloading, which conflicts with the
public-only boundary.

The intended preference chains are `SnapTik Monster → TikVid` for TikTok and
`SaveFromIns → SnapInsta` for Instagram. Router fallback remains sequential, bounded, and terminal
aware. Because the new capabilities declare `deliveryModes: []`, production rejects them before any
provider call; only development fixtures prove the secondary order. No rollout rule, migration,
Delivery host policy, public API, or live candidate probe is added in this item. See the
[Work Item 51 record](work-item-51-free-provider-fallback-batch.md).

### Work Item 52 — 免费 Provider 交付资格验证

Work Item 52 closes the first live qualification loop for the two Work Item 51 adapters without
promoting either one. The NL TikVid check confirmed that the public form uses browser-default GET
and a same-site 302, but the authorized sample produced zero valid MP4 resources. The NL SnapInsta
landing request returned an explicit Cloudflare challenge, so no Instagram URL was submitted.

The shared adapter now models the HTML GET default and rejects generic navigation links that merely
contain download wording. Both manifests and the offline portfolio record `canary_failed`; they
remain disabled, resolution-only, and absent from production route policies. No Delivery Host policy,
rollout rule, migration, public contract, production deployment, or challenge bypass is added. The
next candidate batch may assess TokVid/TikCD/TikVid.io for TikTok and GramSnap for Instagram. See the
[Work Item 52 record](work-item-52-free-provider-delivery-qualification.md).

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

## Work Item 53 — Technical free-Provider qualification

Work Item 53 supersedes page-copy screening with a technical evidence signal. Candidate records now
distinguish `reachable`, `resolved`, `no-media`, and `blocked`; these states defer implementation
without turning transient access friction into a permanent rejection. TikCD has a disabled,
resolution-only adapter backed by the observed `tikwm.com/api` JSON protocol and a reviewed
`tiktokcdn-us.com` delivery policy. Its single-sample result is not production qualification. The
`provider:preflight` command is manual and sanitized; it does not run in CI or create rollout rules.
See [ADR-0032](architecture/adr/0032-technical-provider-evidence.md) and the
[Work Item 53 record](work-item-53-technical-provider-qualification.md).

### Work Item 54 — Production convergence and TikCD secondary route

Work Item 54 is deployed from `main@2e3745e8759f708d0afccb7c2a0e76f3ef9ae50f` using GitHub-built
immutable images. The second TikCD protocol sample, strict redirect adapter and sequential
SnapTik → TikCD fallback code are in place; production health and migration checks passed. Following
owner approval, the three TikCD activation gates are true and the unique `tikcd-tiktok-nl` rule is
enabled at 10000 allocation behind SnapTik Monster (revision 2, no expiry). Two real browser
handoffs succeeded through the SnapTik primary; no forced failover was performed, so no TikCD
production attempt is recorded. Continue observing natural fallback traffic without increasing
request volume. See the [Work Item 54 record](work-item-54-tikcd-secondary-route.md).

### Work Item 55 — Instagram free-Provider qualification and routing boundary

Work Item 55 closes the next Instagram Provider batch as a technical evidence decision. A bounded NL
inspection of GramSnap's actual client protocol found a browser form backed by `POST /api/convert`
with a `target_url` payload, plus browser-held `x-token` and Cloudflare token state. Because the
server-side resolver cannot safely obtain or forward those tokens, GramSnap is recorded as
`technicalState=blocked` and remains out of manifests and production routing. No SaveFromIns
frequency amplification, challenge bypass, or new Delivery Host policy was introduced.

The existing Admin Providers route detail and Beta health aggregate already expose the sanitized
attempt, fallback, delivery and circuit facts needed for natural observation, so no new audit or
database subsystem is added in this batch. SaveFromIns remains the sole Instagram production route;
future candidates must expose a server-callable public protocol before a sequential secondary adapter
is considered. See the [Work Item 55 record](work-item-55-instagram-provider-qualification.md).

### Work Item 56 — Instagram Provider technical test batch

Work Item 56 completed a single bounded NL protocol probe for `fastdl.app`, `snapinsta.to`,
`igram.world`, `sssinstagram.com` and `inflact.com/instagram-downloader/`. The probe checked DNS/TLS,
HTTP status/content type, same-host redirects, challenge markers, forms and client endpoint evidence;
it did not use SaveFromIns, user cookies, login, browser tokens or challenge bypass. Every candidate
was blocked by a Cloudflare/browser-state or login/session boundary before a Reel submission, so no
candidate is `resolved` or `qualified` and no second confirmation sample was attempted. The temporary
probe was removed from both NL and the repository. `provider:preflight` and the offline portfolio now
contain the explicit candidate mappings and sanitized technical states. SaveFromIns remains the only
Instagram production route; this evidence-only batch does not create an adapter, host policy, rollout
rule, or deployment. See the [Work Item 56 record](work-item-56-instagram-provider-technical-batch.md).

### Work Item 57 — Instagram Provider batch 2

Work Item 57 tested the next owner-supplied batch from NL: SaveFrom.net's Instagram page, Collabstr,
IGExport, FastVideoSave and InDown. SaveFrom.net, Collabstr and IGExport exposed Cloudflare or
browser-token/storage boundaries before an anonymous request. FastVideoSave accepted one GET form
submission but returned no media. InDown returned HTTP 419 from its download form, so an anonymous
CSRF/session chain could not be established within the one-request limit. No candidate reached
`resolved` or `qualified`, and no second sample was attempted. The candidate mappings and sanitized
states are recorded in the [Work Item 57 record](work-item-57-instagram-provider-batch-2.md).

This is an evidence-only closeout: no Adapter, Delivery host policy, rollout rule, database change,
or production deployment was made. SaveFromIns remains the only Instagram production route. The
next provider batch must use new candidates or a demonstrably changed anonymous protocol and should
not repeat blocked candidates merely to increase request volume.

### Work Item 58 — Instagram API Provider technical batch

Work Item 58 tested three owner-supplied API candidates from NL using one primary public Reel each:
AHM7 AllDL, Prexzy APIs and experimental ClipLatch. AHM7 and ClipLatch timed out at the bounded
10-second limit. Prexzy's `igv2` response contained no media, its sequential `instagram` endpoint
timed out, and its `aiov2` endpoint returned one MP4 whose media host passed the HTTPS/public-DNS/
Range check. The second confirmation Reel did not complete, so Prexzy is recorded as
`technicalState=resolved` but not `qualified`. No exact response fixture or Adapter is committed
until two-sample success is established without guessing the Schema. See the
[Work Item 58 record](work-item-58-instagram-api-providers.md).

This remains evidence-only: no Delivery host policy, environment gate, rollout rule, database
change or production deployment was made. SaveFromIns remains the sole Instagram production route.

### Work Item 59 — Instagram Provider 技术验证（批次 3）

Work Item 59 从 NL VPS 对六个新候选执行了一次无凭据、无重试的协议级检查：EmbedSocial.jp、
ReelsVideo、Save-Free、AnonSaver、Snap-Insta 和 DLReel。ReelsVideo 与 Save-Free 暴露
Turnstile/验证码或浏览器态字段，AnonSaver 返回 Cloudflare 访问挑战；三者记录为
`technicalState=blocked`。Snap-Insta 的匿名表单请求返回 HTML 且没有可验证 MP4，EmbedSocial.jp
和 DLReel 仅返回页面而未发现可安全调用的公开解析协议，三者记录为 `technicalState=no-media`。

没有候选达到 `resolved` 或 `qualified`，所以没有执行第二 Reel 确认，也没有保存原始响应或完整
CDN 地址。临时探测脚本已从本机和 NL VPS 删除。本批次只更新了 preflight 映射、离线候选矩阵、
测试和证据记录，不创建 Adapter、Delivery Host policy、rollout rule、数据库变更或生产部署。
SaveFromIns 仍是唯一 Instagram 生产路线。详见
[Work Item 59 记录](work-item-59-instagram-provider-batch-3.md)。

### Work Item 60 — Instagram Provider 多维度技术验证

Work Item 60 从 NL VPS 对 VidsSave、FDown.vn、DownloadMedia.app 和 Bolta AI 执行网络、TLS、
HTTP、页面/客户端协议、真实解析与媒体 Range 的多维度验证。四站均可通过公开 DNS、TLS 1.3
和 HTTP 200 页面检查，但没有一个返回可由 TikDD 安全规范化并由客户端无 Cookie 直连下载的
MP4。

FDown 是本批次最接近可用的协议：页面匿名签发的临时 XSRF/session 可以调用同源
`POST /api/instagram/download`，实际字段通过 422 响应确认是 `url`，正确请求返回 HTTP 200
JSON 和两个同站资源；两个资源的无 Cookie Range 请求均返回 HTML，而不是 `206 video/*`，
因此记录为 `technicalState=no-media`。DownloadMedia 的 GET 表单提交没有返回媒体，VidsSave
和 Bolta AI 没有暴露可复现的公开下载协议，也都记录为 `no-media`。

本批次没有候选达到 `resolved` 或 `qualified`，不执行第二样本，不创建 Adapter、Delivery Host
policy、rollout rule、数据库变更或生产部署。SaveFromIns 仍是唯一 Instagram 生产路线。详见
[Work Item 60 记录](work-item-60-instagram-provider-multidimensional-validation.md)。

### Work Item 61 — Instagram client and edge-redirect validation

Work Item 61 excludes Provider-page handoff and reviews every previously supplied Instagram
candidate against two alternatives. Prexzy is the only candidate with both anonymous API CORS and
two successful NL media results, but the real browser call did not complete inside the 10-second
window. Coupling Web directly to a Provider would also bypass normalization, routing, attempt-ledger
and circuit-breaker boundaries, so browser-direct Provider API access is not being shipped.

A fixed-Provider, fixed-sample Cloudflare Worker prototype passed five local tests for authorization,
Instagram host validation, static media-host validation, fail-closed behavior and byte-free `302`
delivery. The Cloudflare runtime probe remains unverified because the Wrangler runtime dependency
could not be downloaded and the official Playground did not load within the test window. No Worker,
proxy, Adapter, rollout or production change was deployed. A production Edge Resolver requires a
new ADR covering one-use tickets, Provider/host policy, throttling, redaction and rollback. See the
[Work Item 61 record](work-item-61-instagram-client-edge-delivery-validation.md).

### Work Item 62 — Free Provider Lab and server-side protocol evidence

Work Item 62 adds an evidence-only Provider Lab for the owner-supplied Prexzy, AHM7, Cobalt,
TikTok Downloader Worker, ClipX, PostVault, ClipLatch, TikWM, AnyDownloader and ReClip candidates.
Remote checks are sequential and low-frequency with a ten-second timeout, public-DNS/HTTPS and
redirect validation, and a bounded media Range probe. Sample URLs, response bodies, cookies,
tokens, titles, authors and complete CDN URLs are never persisted or printed. A 429, challenge or
upstream 5xx stops that candidate without an automatic retry.

The NL run found no new two-sample `qualified` candidate: Cobalt and TikWM were blocked by access
challenges, the TikTok Downloader Worker and PostVault returned transient upstream errors, and
ClipX was only reachable without a confirmed active endpoint. Previous Prexzy, AHM7 and ClipLatch
evidence remains unchanged and does not qualify an adapter. AnyDownloader and ReClip were reviewed
only as local Docker candidates; both download and store media on the server, so they do not fit
TikDD's redirect-only path. Local Docker Desktop was unavailable during this batch, and neither
source was built or started.

The code-owned lab catalog, sanitized probe tests, preflight mappings and offline portfolio records
are documented in the [Work Item 62 record](work-item-62-free-provider-lab.md). This closes as
evidence-only: no adapter, Delivery host policy, rollout rule, database change, Admin lifecycle
change or production deployment. SaveFromIns remains the sole Instagram production route; future
provider work must present a demonstrably server-callable anonymous protocol or a separately
approved isolated yt-dlp/FFmpeg design.

### Work Item 63 — Non-Instagram platform Provider validation

Instagram Provider research is paused. Work Item 63 used the six owner-supplied public samples for
Facebook, Vimeo and Pinterest to exercise the existing DLPanda adapter from NL VPS. All six samples
hit `provider_challenge` at the DLPanda request boundary before any media request, normalized result
or Delivery candidate was available. The common failure across three platforms and two samples per
platform indicates an access boundary at DLPanda/NL, not a platform-specific parser defect. No
challenge bypass, login, cookie, browser state or full media download was attempted.

No new adapter, Host policy, rollout rule, environment gate, database or production change was made;
the existing DLPanda capabilities remain resolution-only/unverified and all production routes are
unchanged. The evidence and cleanup record are in the [Work Item 63 record](work-item-63-multiplatform-provider-validation.md).

The next stage is a consolidated non-Instagram candidate batch, prioritizing genuinely new free
Providers for Facebook, Vimeo and Pinterest. SocialKit and SaveAPI remain deferred until a separate
commercial-API review covers official protocol, terms, pricing, quotas, secret injection and
rollback.

### Work Item 74 — Facebook Beta productization and bounded dual routing

Work Item 74 productizes the already audited Facebook route without changing its transport
boundary. FDown Isuru remains primary and SocialDownloader remains the unique NL secondary route;
the public homepage and starter metadata now describe Facebook as Beta, while sitemap and stable
platform pages remain unchanged. The Admin route workspace continues to expose the exact provider,
allocation, gate, circuit and fallback projection without adding persistence or operator audit
fields.

SocialDownloader keeps the reviewed `socialdownloader-space-facebook-media-v1` policy and
`browserHandoff=navigate`. A fresh low-frequency protocol probe did not establish a repeatable CORS
and browser-save contract, so no `cors-download` policy is introduced and no automatic-save claim is
made. The one-use Delivery redirect remains byte-free and Provider-page handoff remains forbidden.
See [Work Item 74](work-item-74-facebook-beta-productization.md).

### Work Item 64 — Facebook free Provider candidate batch

Work Item 64 tested the owner-supplied `fdown.net`, `fdownloader.vn` and `fget.io` candidates from
NL VPS using the bounded Provider Lab. `fdown.net` returned HTTP 403 with an access challenge.
`fdownloader.vn` exposed a same-origin `POST /api/download` request with a URL field, but both
public Facebook samples returned HTTP 419 JSON and no media, indicating an anonymous CSRF/session
boundary. `fget.io` was reachable but exposed no safe public parsing endpoint; only static page
assets were observed. No candidate reached `resolved` or `qualified`.

The test input and protocol inspection scripts were temporary and removed after the run. No response
body, Cookie, Token, Provider page or CDN URL was persisted. The three candidates are recorded in
the offline Provider portfolio as blocked/no-media evidence. No adapter, Host policy, rollout rule,
environment gate, database change or production deployment was made. Existing DLPanda, Facebook,
X, TikTok and Instagram production states remain unchanged.

## Definition of done for every new adapter

1. Compliance owner and upstream terms review are documented.
2. Manifest and platform capability matrix are validated at startup.
3. Sanitized success and failure fixtures cover every mapped error class.
4. Contract, timeout, cancellation, SSRF/redirect, and secret-leak tests pass.
5. Scheduled canaries, metrics, circuit thresholds, and a rollback flag exist.
6. The adapter launches disabled and is promoted gradually by platform and region.

### Work Item 65 — mixed free Provider technical batch

Work Item 65 tested four owner-supplied candidates from the NL VPS using protocol evidence rather
than page claims. Instagram Video Downloader (Vercel) exposed a form-encoded `POST /api` call but
the endpoint returned HTTP 404 HTML. ReelSaver.fun returned HTTP 422 JSON without media. ViDown's
separate API origin returned HTTP 403 for Instagram and timed out for Facebook. These three are not
usable for a TikDD route in the observed access boundary.

FDown Isuru exposed an anonymous JSON `POST /download` protocol. Both existing Facebook samples
returned HTTP 200 and four media resources each passed public-DNS and bounded Range validation on
the `fbcdn.net` suffix. It is recorded as `technicalState=resolved`, not production-qualified:
fixtures, a tolerant parser, manifest, Delivery Host policy and browser handoff still need review.
See the [Work Item 65 record](work-item-65-provider-candidate-batch.md). No production state changed.

### Work Item 66 — FDown Isuru Facebook Beta adapter

Work Item 66 implements the first Facebook candidate with repeatable anonymous protocol evidence.
The adapter uses one bounded JSON `POST /download` request, tolerant parsing of the observed
`video_info`/`available_formats` response, typed terminal versus retryable failures, and no Cookie,
login or challenge bypass. Only MP4 resources on the reviewed `fna.fbcdn.net` suffix are encrypted
as Delivery redirect candidates; the public result remains URL-free.

The Provider is registered in Worker, API diagnostics and Admin route previews behind three
default-off gates: `ENABLE_FDOWN_ISURU_PROVIDER`, `FDOWN_ISURU_TERMS_APPROVED` and
`FDOWN_ISURU_DELIVERY_AUDIT_APPROVED`. Sanitized success, private, unavailable, rate-limit,
challenge, no-media and malformed fixtures plus Host/redirect tests are included. The adapter is
not yet production-enabled or deployed; browser Delivery verification and rollout approval remain
the next release step. See [Work Item 66](work-item-66-fdown-isuru-facebook-beta.md).

### Work Item 67 — FDown Isuru Facebook 下载修复

Work Item 67 repairs the first FDown delivery failure observed from NL. Real successful responses
contained public MP4 resources on ordinary `*.fbcdn.net` subdomains, while the previous adapter
accepted only `*.fna.fbcdn.net`; candidates were therefore discarded before Delivery. Versioned
policy v2 now accepts real `fbcdn.net` subdomains while retaining v1 for legacy tickets and the
existing HTTPS/public-DNS/redirect/one-use checks. Facebook jobs make one FDown request per task,
queue-level replay is disabled for this Provider, and internal diagnostics contain only sanitized
counts and timing. No public contract, database, Admin or other Provider state changes. See
[Work Item 67](work-item-67-fdown-facebook-repair.md).

### Work Item 68 — FDown runtime configuration binding

The first Work Item 67 browser check did not invoke FDown because the Worker retained the previous
environment snapshot and all three FDown gates were false. Work Item 68 adds the release-env-bound
`worker-config-apply` operation, force-recreates only the Worker, and verifies the configuration
revision and FDown gates inside the running container before rollout. It records the event as a
runtime binding failure rather than Provider evidence; FDown parsing and Delivery policy v2 remain
unchanged until a real Provider attempt is observed. See
[Work Item 68](work-item-68-provider-runtime-config-binding.md).

### Work Item 69 — FDown thumbnail and client save

Work Item 69 restores FDown's reviewed `*.xx.fbcdn.net` thumbnail and adds an optional Delivery
`browserHandoff` strategy. FDown v2 uses a bounded credential-free browser CORS fetch and Blob
save so media bytes travel from the user's browser to Meta CDN; Delivery remains a one-use 302
and never proxies media. Failed saves offer an explicit fresh-ticket playback fallback without
replaying the Provider. Other Providers retain navigation, and production FDown rollout/gates
remain unchanged pending a separately authorized deployment. See
[Work Item 69](work-item-69-fdown-thumbnail-client-save.md) and
[ADR-0034](architecture/adr/0034-fdown-thumbnail-client-save.md).

### Work Item 72 — SocialDownloader Facebook secondary routing

Work Item 72 将 Work Item 71 中 Facebook 两个可重复样本的 SocialDownloader 证据落到一个
默认关闭的适配器和版本化 Delivery policy。FDown Isuru 保持高优先级；只有可回退的上游
失败才顺序尝试 SocialDownloader，每个任务最多一次 Provider 请求，422/no-media、私有和
不支持内容不触发更低级路由。Delivery 仅允许精确的
`www.socialdownloader.space/api/video`，仍使用一次性票据和 302，不由 NL VPS 读取媒体。
`ENABLE_SOCIALDOWNLOADER_PROVIDER`、`SOCIALDOWNLOADER_TERMS_APPROVED` 和
`SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED` 默认均关闭。X/TikTok 虽已补充一次协议样本，仍因
缺少浏览器交付审计保持 Lab-only；Instagram、YouTube 不加入。详见
[Work Item 72](work-item-72-socialdownloader-secondary-routing.md) 和
[ADR-0035](architecture/adr/0035-socialdownloader-secondary-routing.md)。

### Work Item 71 — 多平台免费 Provider 技术资格验证

Work Item 71 对 SocialDownloader、Social Media Downloader、Instagram Video Downloader、
ReelSaver、Gram Grabberz、FacebookOne 和 ReelDown 执行了协议级被动检查及受限主动矩阵。
SocialDownloader 的 X、Instagram、TikTok 和 Facebook 主样本能返回 MP4，但均为 Provider
自有流式地址；Facebook 第二样本也成功，Instagram 第二样本返回 422，因此没有 direct-CDN
或透明 302 的可生产候选。YouTube 主样本超时，未继续请求确认样本。其他候选分别被
RapidAPI 密钥依赖、429、404/422、挑战或网络不可达阻塞/延后。

本批次共发出 15 个受限请求，低于 55 请求预算；没有下载完整媒体，没有使用账号、Cookie、
验证码或 Provider 页面接力。Provider Lab 已升级为 schema 2 的按平台 `activeEndpoints`，
并强制矩阵平台白名单、顺序执行、单媒体 1 KiB Range 和脱敏输出。证据详见
[Work Item 71 记录](work-item-71-multiplatform-provider-qualification.md)。

本项不创建 Adapter、Delivery Host Policy、数据库迁移、门禁、rollout rule 或生产部署。
SocialDownloader 仅保留为后续服务器代理风险评审的条件候选；现有 X、TikTok、Instagram、
Facebook 生产 Provider 和 Admin/calibration 状态不变。

### Work Item 73 — SocialDownloader Facebook 生产资格审计与受控上线

Work Item 73 follows the merged `main@774491d` baseline and closes the operational gap left by
Work Item 72. It first deploys the default-off code with the existing Facebook route unchanged,
then audits the Provider-owned `/api/video` stream through the one-use Delivery redirect and a
real browser. The audit covers redirects, MIME, Range, expiry, Content-Disposition/CORS and save
behavior; it must not turn TikDD into a media proxy or expose the Provider page. The release
script now verifies both FDown Isuru and SocialDownloader gate triplets during the isolated
Worker configuration apply.

Only after two one-shot browser checks pass may the owner enable the three SocialDownloader gates
and create the unique `socialdownloader-space/facebook/nl` rollout rule. The steady-state route
remains `FDown Isuru → SocialDownloader`; a temporary SocialDownloader-first policy is used only
for the owner-controlled audit and is removed immediately afterward. A failed audit disables the
rollout and gates without changing existing X, Instagram, TikTok, FDown, Admin or calibration
state. See [Work Item 73](work-item-73-socialdownloader-facebook-production-audit.md) and
[SocialDownloader Provider notes](providers/socialdownloader.md).

### Work Item 75 — Multi-platform Provider routing and Facebook Beta closeout

Work Item 75 models SocialDownloader as one Provider with independent Facebook, X, TikTok,
Instagram, and YouTube capabilities. Rollout rules, circuits, Delivery policies, and Admin health
remain keyed by `provider/platform/region`. Only Facebook is delivery-verified and active in
production; the other capabilities remain Lab-only until their own two-sample and browser handoff
evidence is complete.

Because the hosted service can rate-limit the NL egress IP across platforms, the Worker applies a
shared fail-fast concurrency/interval budget and honors bounded `Retry-After` cooldowns. Admin Beta
Health now includes Facebook while remaining a sanitized read-only aggregate. The four manually
verified Facebook samples close the operational acceptance evidence; Facebook remains Beta and
outside the sitemap. See the [Work Item 75 record](work-item-75-multiplatform-provider-routing.md)
and [ADR-0036](architecture/adr/0036-multi-platform-provider-routing.md).

### Work Item 76 — SocialDownloader X/TikTok secondary routing

Work Item 76 converts the existing NL protocol evidence for SocialDownloader X and TikTok into
independently gated secondary capabilities. X remains behind the existing approved X route; TikTok
keeps `SnapTik Monster → TikCD` ahead of SocialDownloader. Each capability has its own versioned
Delivery policy, rollout tuple, circuit and rollback decision even though both use the reviewed
`www.socialdownloader.space/api/video` stream.

The Worker now separates `SOCIALDOWNLOADER_APPROVED_PLATFORMS` from
`SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS`; both default to `facebook`, and the latter must be
a subset of the former. This prevents a new image from creating X/TikTok traffic before the
platform-specific browser handoff audit. A platform rollback removes only that platform from both
lists and disables its rollout rule. Instagram and YouTube remain Lab-only, Facebook remains the
active Beta secondary route, and the shared request budget/Retry-After protection applies across
all SocialDownloader platforms. See the [Work Item 76 record](work-item-76-socialdownloader-x-tiktok-routing.md)
and [ADR-0037](architecture/adr/0037-socialdownloader-platform-activation.md).

### Work Item 77 — SocialDownloader production route closeout

Work Item 77 records the owner-observed local-browser handoff for X and prepares the existing
SocialDownloader X capability as the sequential fallback after SSSTwitter. The NL VPS is not used
as a media-download probe: a server-side 403 can coexist with a successful user-browser download
because Delivery remains a one-use 302 to the Provider stream.

TikTok received one isolated browser handoff check. SnapTik Monster and TikCD were temporarily
disabled only for that check and restored immediately afterward. The resolve returned a format,
but the Download action was rejected as unavailable for secure Delivery, so the SocialDownloader
TikTok rule was disabled and TikTok was removed from both runtime lists. TikTok remains Lab-only;
Facebook and X remain active, while Instagram and YouTube stay Lab-only. No adapter, public
contract, database, Host policy, media proxy, sitemap or calibration change is included. See the
[Work Item 77 record](work-item-77-socialdownloader-production-closeout.md).

### Work Item 78 — Multi-platform route operations pulse

Work Item 78 adds a compact read-only `平台路由体温` view to the Admin Providers workspace. It
reuses the sanitized effective route plan, route health summaries, and persisted Beta aggregates to
show each platform's active primary/fallback chain, sample count, weighted success/fallback rates,
and latest observation. Missing samples remain `等待自然流量`; disabled capabilities remain
`当前无生产路线`.

This slice adds no Provider request, public endpoint, database migration, rollout change, Host
policy, media path, or second routing authority. SocialDownloader/TikTok stays disabled and
Lab-only; X, Facebook, Instagram, and the TikTok SnapTik → TikCD chain retain their existing
production state. See the [Work Item 78 record](work-item-78-route-operations-pulse.md).
### Work Item 79 — Pinterest / Vimeo Provider expansion

Work Item 79 is the next bounded free-Provider batch after the route operations pulse. The
protocol review selected Pinterest as the only current Beta candidate: the anonymous
`pinterest-videodownloader.com/api/pin` endpoint produced repeatable direct `v1.pinimg.com`
MP4 resources for two public Pins, and the media host passed 1 KiB Range/MIME checks. Its
adapter, exact redirect policy and three activation gates are implemented but remain default-off
until the owner-authorized production browser handoff is complete.

The supplied Vimeo candidates are deferred: MediaFetcher and ClipSave produced no media, WhiteHole
had no public extract endpoint, TryUnsora exposed a login boundary, and SocialDownloader was
challenged. A supplemental retest added SnapFetchr, ReelsDownloader.in, SavePanda and SnapVideo:
SnapFetchr exposed only a Provider-side proxy handoff, ReelsDownloader requires an integration
credential (and its web surface loads Turnstile), while SavePanda and SnapVideo did not expose a
callable anonymous resolver in the bounded public surface. No Vimeo adapter, sitemap entry,
Provider-page handoff or media proxy is introduced.
Existing X, Instagram, TikTok, Facebook, Admin and calibration state remains unchanged. See
[Work Item 79](work-item-79-pinterest-vimeo-provider-beta.md),
[ADR-0038](architecture/adr/0038-pinterest-videodownloader-direct-cdn.md).

### Work Item 80 — Pinterest Beta production launch and platform status alignment

Work Item 80 aligns the catalog and bilingual home-page/starter copy with the reviewed Pinterest
capability. Pinterest is now classified as `experimental` and presented as a public Beta, while its
adapter and exact `v1.pinimg.com` redirect policy remain behind the three existing activation gates
until the owner-authorized production browser handoff. The release uses the fixed small-batch loop:
GitHub-built immutable images, backup, health check, two real Pin downloads, and a 10-minute watch.

The code does not add a Pinterest landing page or sitemap entry, public API, database migration,
media proxy, or new routing authority. Vimeo remains deferred, and X, Instagram, TikTok, Facebook,
Admin, and calibration keep their existing platform-specific state. See the
[Work Item 80 record](work-item-80-pinterest-beta-launch.md).

### Work Item 81 — Pinterest schema repair and Beta status closeout

The first controlled Pinterest launch was rolled back after the provider returned an oEmbed-style
`rich` response that the adapter rejected; the same task also revealed that the generic queue
budget replayed the provider three times. Work Item 81 accepts the observed rich/video shape,
keeps optional metadata nullable, limits Pinterest to one Provider execution per submission, and
removes the disabled capability from public Beta copy until direct browser evidence is complete.
It also makes the production release script pass the configured host memory/Swap thresholds into
each stage gate. No media proxy, Host-policy expansion, database migration, sitemap entry, or
change to existing platform routes is included. Pinterest remains Experimental and fail-closed
until two one-shot public samples succeed through TikDD Delivery.

### Work Item 82 — SaveVideo、VidDown、DownBot 多平台 Provider 技术资格验证

Work Item 82 records a bounded protocol review of three newly proposed multi-platform services.
The Lab keeps candidate landing pages separate from per-platform `activeEndpoints`, so a hosted
service's marketing list cannot create a route for every platform automatically. The owner has
now confirmed successful browser use on all three sites. Two bounded NL replays using the supplied
Vimeo samples promoted VidDown to repeatable `resolved`: its anonymous page-token flow returned MP4
candidates and Vimeo CDN Range responses for both samples. SaveVideo still returns an HTML error
from NL, while DownBot's correct JSON request returns HTTP 400 without a job. VidDown is now the
sole lead for the next adapter work; all three remain deferred and production-disabled until
fixture, adapter, Delivery and browser evidence are complete.

No adapter, Delivery Host Policy, gate, rollout, database, public page, sitemap, or production
traffic changes are included. See [Work Item 82](work-item-82-multiplatform-provider-qualification.md).

### Work Item 83 — VidDown Vimeo adapter and gated Beta preparation

Work Item 83 implements the first Vimeo adapter from the Work Item 82 evidence. VidDown uses an
anonymous page-token flow and returns tolerant `data.links[]` MP4 parsing for exact
`player.vimeo.com` media targets; `i.vimeocdn.com` thumbnails are optional. The older evidence
description of `vimeocdn.com` is corrected by the latest exact-host probe. Delivery policy,
Worker/API/Admin registration, preflight and release-script checks are present, but all three
VidDown gates and the `viddown-net / vimeo / nl` rollout tuple remain disabled.

This item deliberately does not mark Vimeo stable, add sitemap content, or deploy production. A
future release must separately audit browser handoff/save behavior; a 302 that opens a Vimeo player
is not proof of a saved file. SaveVideo and DownBot remain deferred candidates, and existing X,
Instagram, TikTok, Facebook, Pinterest, Admin and calibration state is unchanged. See [Work Item
83](work-item-83-viddown-vimeo-beta.md) and [ADR-0039](architecture/adr/0039-viddown-vimeo-direct-cdn.md).

### Work Item 84 — VidDown Vimeo handoff diagnostic closeout

The first NL recheck returned no media because VidDown had changed its anonymous token flow and the
page exceeded the former adapter response bound. That run is retained as a historical protocol-drift
diagnostic; the adapter's bounded error classification remains unchanged. See [Work Item 84](work-item-84-viddown-vimeo-handoff.md).

### Work Item 85 — VidDown dynamic token repair and Vimeo Beta validation

Work Item 85 updates the adapter to prefer VidDown's strictly validated inline dynamic token, retain
the legacy endpoint as a bounded fallback, and read the current page within a 256 KiB limit. The
repaired flow was reproduced against both reviewed Vimeo samples with loader success and MP4
candidates. Production gates and rollout remain disabled until the browser handoff/save audit,
exact-SHA image deployment, and two one-attempt downloads complete. Vimeo remains Experimental/Beta
and is not added to the sitemap. See [Work Item 85](work-item-85-viddown-vimeo-token-repair.md).

### Work Item 86 — VidDown dynamic token and challenge-chain repair

The first authorized production browser validation after Work Item 85 reached
VidDown once and returned `provider_challenge`; the route was immediately
disabled and the second sample was not submitted. Work Item 86 adds internal,
sanitized phase diagnostics and tightens inline-token parsing, legacy fallback boundaries,
and short-lived request-chain cookie merging. It does not bypass challenges,
change Delivery, add a proxy, or alter existing provider traffic. VidDown stays
disabled until a bounded NL canary and two sequential browser downloads pass.
See [Work Item 86](work-item-86-viddown-challenge-repair.md).

### Work Item 87 — VidDown landing challenge false-positive repair

The authorized Work Item 86 production window produced three one-attempt failures at the VidDown
landing phase. Each response was HTTP 200 HTML with the same size as the previously successful
protocol page, and none reached token selection or the loader API. The generic challenge detector
was treating static Cloudflare/Turnstile library references as an active interstitial.

Work Item 87 keeps the shared default behavior for other Providers and gives VidDown a structural
classifier: HTTP 403 remains blocked, while HTTP 200 requires document-level access-denied or
Cloudflare interstitial evidence. Structural challenge evidence still wins when a token is present;
otherwise a valid inline token is accepted when the normal page loads challenge-related libraries.
Sanitized diagnostics now record a bounded reason enum and cookie
presence only. Production stays at rollout revision 4 with zero allocation and all VidDown gates
closed until the repaired exact image passes one bounded NL canary and two sequential owner browser
downloads. See [Work Item 87](work-item-87-viddown-challenge-classifier.md) and the
[ADR-0039 addendum](architecture/adr/0039-viddown-vimeo-direct-cdn.md#challenge-classifier-addendum-work-item-87).

### Work Item 88 — Admin growth truth and workspace refinement

Work Item 88 fixes two owner-console trust gaps before further Provider expansion. Google Analytics
and AdSense now show draft versus active-snapshot state, use the existing publication command, load
once from the localized Web layout, and expose the published AdSense account through bounded
metadata and `/ads.txt`. Download reporting now separates tasks, Provider attempts, tickets,
redirect validation, and browser handoff instead of presenting unlike events as completed downloads.

Admin is reorganized into five readable single-owner workspaces, with a dedicated Downloads and
traffic view, dynamic platform rows from Provider manifests, larger type, tighter information
density, and low-frequency recovery controls collapsed in Settings. No audit workflow, database
migration, Provider traffic change, media proxy, or production activation is part of this item. See
[Work Item 88](work-item-88-admin-growth-truth-ui.md) and the
[ADR-0028 addendum](architecture/adr/0028-code-owned-google-site-integrations.md#activation-truth-addendum--work-item-88).

### Work Item 89 — Production operations and route closeout

Work Item 89 accepts the Work Item 88 Admin and Google integration behavior against production
facts, reconciles the download funnel with PostgreSQL, and removes empty capability-only cards from
the event-focused Downloads workspace. It also makes the Admin API and Worker share the same
validated SocialDownloader platform boundary so the control-plane manifest matches the live
`facebook,x` configuration.

The current route order is frozen by tests as SSSTwitter → SocialDownloader for X, SaveFromIns for
Instagram, SnapTik Monster → TikCD for TikTok, FDown Isuru → SocialDownloader for Facebook, and
VidDown for Vimeo. The owner-authorized production window then enabled Pinterest at full allocation
on the existing unique revision-3 rule. Two public Pins each produced one Provider attempt and a
validated `206 video/mp4` response from the exact reviewed `v1.pinimg.com` host; the circuit remained
closed and the core services remained healthy. Pinterest stays Experimental/Beta and outside the
sitemap. See [Work Item 89](work-item-89-production-operations-route-closeout.md).

### Work Item 90 — Multi-platform Beta productization and support truth

Work Item 90 aligns the six currently usable production platform families before another Provider
expansion batch. Facebook and Vimeo move from `planned` to `experimental`; Pinterest remains
experimental and TikTok remains the only stable platform. The code-owned bilingual content set adds
noindex Facebook, Vimeo, and Pinterest pages, while the release-owned homepage and shared copy name
all six supported platforms. Only the homepage and TikTok remain sitemap-eligible.

Admin gains a compact read-only support-truth ledger derived from existing sanitized catalog,
route, natural-event, content, and SEO models. It highlights cross-authority drift without probing a
Provider, changing traffic, or claiming that a browser handoff proves a saved file. This batch adds
no public API, migration, Provider, Delivery mode, rollout, gate, or calibration change. See
[Work Item 90](work-item-90-multiplatform-beta-productization.md).

### Work Item 91 — Instagram recovery and bounded fallback decision

Work Item 91 responds to a seven-day window with no successful SaveFromIns attempts. Production
containment CAS-disables only the Instagram/NL rule at revision 16. The adapter now distinguishes
explicit upstream failures from schema drift, records only bounded structural diagnostics, accepts
missing optional quality, and uses one Provider execution per Instagram task. The existing Delivery
host policy and public contracts remain unchanged.

A current two-sample SocialDownloader Instagram recheck produced one reviewed 206 MP4 stream and
one timeout, so it remains Lab-only and no fallback rule or policy is created. Instagram reopens
only after the exact GitHub image passes two sequential one-attempt browser downloads. See
[Work Item 91](work-item-91-instagram-recovery.md) and
[ADR-0040](architecture/adr/0040-instagram-single-attempt-recovery.md).
