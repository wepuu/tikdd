# TikDD

TikDD is a multilingual, provider-agnostic public media resolver. A user submits a recognized public
page URL, the control plane creates an asynchronous task, and a worker routes through eligible
providers in priority order until one returns valid normalized metadata and formats. A separate
delivery service turns reviewed internal candidates into controlled browser delivery.

The local scaffold uses a development-only mock provider. TwitterSaver and SSSTwitter have
delivery-verified X redirect capabilities; SaveFromIns has a delivery-verified Instagram Beta
redirect capability; DLPanda has multi-platform resolution-only capabilities; SnapTik Monster has
a reviewed TikTok redirect adapter enabled in the NL production route. All real adapters
remain behind deployment enablement, approval, rollout, region, health, and delivery gates.
Candidate URLs stay encrypted server-side and opaque one-use tickets redirect only to reviewed
media hosts. The browser follows the redirect and downloads media directly from the reviewed host,
so the user's network reaches the Provider CDN and the NL VPS does not carry media bytes. TikDD may
provide a best-effort `TikDD-Platform-ContentId-Quality.ext` filename hint, but cross-origin CDN
behavior can still determine the final filename. Proxying, temporary files, and media downloads by
TikDD remain disabled.

## Architecture

```text
Web (SEO/UI) -> API -> platform catalog -> Redis queue -> resolver worker
                    |                              |
                    +---- PostgreSQL <--- provider router -> adapters

Selected format -> delivery service -> one-use 302 -> user browser -> reviewed media host
```

Start with [the architecture guide](docs/architecture/README.md),
[platform catalog](docs/platform-catalog.md), [routing policy](docs/routing-policy.md), and
[rebaselined development roadmap](docs/development-plan.md). Earlier execution plans are retained as
historical records. Read the
[ADR index](docs/architecture/adr/README.md) before changing service boundaries.

The reproducible production foundation and shared-host operating boundary are documented in the
[production deployment runbook](docs/production-deployment.md).

The password-authenticated owner control plane includes Provider routing, platform presentation,
locale/content modeling, immutable publication, SEO eligibility, bounded settings, and snapshot
recovery. Snapshot promotion is fail-closed: a candidate becomes active only after Web
acknowledgement. See the [work item 12 baseline](docs/work-item-12-11-implementation.md).

Work Item 23 ships the bilingual Instagram Beta landing page at
`/[locale]/instagram-downloader`. It remains a human-review page: noindex, absent from sitemap and
hreflang, and separate from Provider rollout until the catalog eligibility gate passes. See the
[Work Item 23 record](docs/work-item-23-instagram-landing-page.md). Work Item 24 adds fixed,
code-owned JSON-LD only to eligible published pages; it never accepts raw structured data from
Admin. Work Item 25A adds a bounded GEO answer block with code-owned source references, and Work Item
25B wires bounded bilingual Instagram inputs into the seed/content flow while keeping experimental
platform pages noindex. See the [Work Item 25B record](docs/work-item-25b-instagram-geo-content.md).
The Work Item 26 reliability closeout is recorded in the [Work Item 26 record](docs/work-item-26-instagram-reliability.md):
the current SaveFromIns/Instagram Beta has a verified non-zero Delivery transfer and remains
noindex/experimental. Work Item 27 adds only provider-neutral failure feedback and the read-only
`pnpm beta:report` aggregate; it does not start Admin or calibration or enable another Provider.
Work Item 28 keeps this redirect-only delivery path, adds a browser filename hint, and bounds
SaveFromIns Instagram retries and diagnostics without changing public contracts or media routing.
The WI28 production closeout is complete on `main@bdf6543a`; Work Item 29 retains SaveFromIns as the
owner-approved usable Instagram Beta while pausing paid replacement research. Future free Provider
candidates will be validated individually. Work Item 30 adds a private Admin Beta health view; it does
not change production traffic or start Admin, calibration, or another Provider. Work Item 31 merged
the Admin UI closeout in PR #69 by grouping Beta health with the existing operations navigation,
localizing the operator copy, and hardening malformed aggregate rendering. Work Item 32 completed
the approved owner-only Admin preview through `admin.tikdd.cc`; Admin remains an on-demand profile
and is stopped outside an explicitly approved session. Work Item 33 hardens the release script and
stage-gate contract exposed by that preview. Work Item 34 adds read-only request-cadence guidance
and per-platform activity freshness to the Admin Beta view; it does not probe Providers or change
traffic. See the [Work Item 33 record](docs/work-item-33-admin-lifecycle-gate-fix.md) and [Work Item 34
record](docs/work-item-34-admin-provider-cadence.md).

Work Item 35 adds a server-enforced Admin write scope: production defaults to `readonly`, while an
explicit `content-draft` mode permits only non-public content drafts and `full` is reserved for
deliberate local or maintenance operations. The UI displays the active scope and hides or disables
commands outside it; this does not start Admin or change Provider traffic. See the [Work Item 35
record](docs/work-item-35-admin-content-draft-mode.md).

Stage 1 adds bounded Google Analytics and Google AdSense site integrations to Admin settings. Only
validated `G-...` and `ca-pub-...` identifiers are accepted; Web renders fixed code-owned tags
after a published snapshot, never arbitrary Admin JavaScript. The stage is deployed from the current
production lineage; values remain disabled until an owner publishes them. See the [Stage 1 record](docs/stage-1-admin-integrations.md)
and [ADR-0028](docs/architecture/adr/0028-code-owned-google-site-integrations.md).

Stage 2 groups the Admin publishing work into one control-room release: a read-only publication
overview combines content coverage, SEO blockers, snapshot propagation, and integration readiness,
while the existing structured editors and immutable publication commands remain the source of truth.
See the [Stage 2 record](docs/stage-2-admin-publishing-center.md).

Stage 3 groups the next content and growth work into one release: bilingual X/Instagram Beta content,
an Admin growth-readiness view, and fixed privacy-safe GA funnel events. It does not read Google
account reports, store user-level analytics, add Provider traffic, or make Beta pages indexable. See
the [Stage 3 record](docs/stage-3-growth-content-measurement.md).

Stage 2 of the Provider expansion lane is tracked as Work Item 44. It adds an offline free-Provider
intake and a bounded access-friction adjustment to the shared route score; it does not add a new
Provider or generate live third-party traffic. SaveFromIns remains the Instagram Beta route, and
future free candidates must pass the same public/no-cookie/no-challenge and delivery review before
they can be implemented. See the [Work Item 44 record](docs/work-item-44-free-provider-portfolio.md)
and [ADR-0031](docs/architecture/adr/0031-free-provider-intake-and-bounded-routing.md).

Work Item 45 implements the first accepted candidate from that lane as a disabled SnapTik Monster
TikTok adapter. It uses the existing resolver-to-redirect path, exact page/media host allowlists,
sanitized fixtures, and independent activation gates. SSSTik and TTSave remain deferred, while
Collabstr is rejected as a non-resolution service. The follow-up TikTok Beta launch batch also adds
the bilingual, non-indexable TikTok landing page and updates the public copy to identify TikTok as
experimental. Provider gates and rollout remain disabled until the separate production approval
loop; no new Provider traffic is implied by the code or content change. See the [Work Item 45
record](docs/work-item-45-tiktok-provider-batch.md) and [Work Item 46 record](docs/work-item-46-tiktok-beta-launch.md).
Work Item 47 prepared the Admin three-platform health view and the on-demand publication workflow
for the TikTok landing pages. See the [Work Item 47
record](docs/work-item-47-tiktok-beta-launch-readiness.md). Work Item 48 is merged and deployed
from `main@5008685f2f50528ac1861e5b95c14d549013d1c1`; it makes the SnapTik Delivery handoff a
single browser action. Work Item 49 then published the TikTok Beta snapshot and enabled the
approved SnapTik route for natural-traffic evaluation. Work Item 50 records the owner-approved
natural-traffic closeout: TikTok is promoted to stable in the catalog and its reviewed bilingual
landing pages are prepared for sitemap publication. The Web flow reports the browser handoff
and requests a fresh one-use ticket for “download again”; it never reopens a consumed ticket. See
the [Work Item 49 record](docs/work-item-49-tiktok-beta-closure.md).

Stage 4 / Work Item 38 adds a code-owned bilingual starter content set and a guarded Admin
first-run bootstrap. It is merged and deployed from `main@8f6eb9b`; the action creates only `ready`
drafts before the first immutable snapshot, while the owner still reviews and publishes through the
existing `full` maintenance mode. Stage 5 / Work Item 39 is complete: the first immutable snapshot
was published at `r1`, acknowledged by Web, and Admin was returned to `readonly` and stopped. Web
fallback and Admin bootstrap share the same contracts, with no Provider or rollout change. Stage 6 /
Work Item 40 now hardens the publication control room and release-script Admin lifecycle as one
bounded batch; it does not start Admin during normal deployment. See the [Work Item 38 record](docs/work-item-38-content-bootstrap.md),
[Work Item 39 record](docs/work-item-39-first-content-publication.md),
[Work Item 40 record](docs/work-item-40-admin-publication-ops.md), and
[ADR-0029](docs/architecture/adr/0029-starter-content-bootstrap.md).

Stage 7 / Work Item 41 adds the structured editorial workflow used by the owner to edit and preview
code-owned page templates. Stage 8 / Work Item 42 reorganizes the Admin shell into four focused
workspaces—概览、内容、Providers、设置—so daily editing does not require entering audit fields such
as an operator, reason or deployment ID. Those values remain internal to the existing Admin API
commands for concurrency and replay protection; Provider routing and recovery actions keep their
explicit confirmations. Admin remains an on-demand, non-indexable control plane. See the [Work Item 42
record](docs/work-item-42-admin-workspace-simplification.md).

## Platform and provider model

The catalog recognizes 44 explicit platform families, including TikTok, YouTube, X, Instagram,
Facebook, Vimeo, Dailymotion, Reddit, Twitch, SoundCloud, Bilibili, Douyin, Kuaishou, Pinterest, VK,
Streamable, Tumblr, Weibo, Xiaohongshu/RedNote, Snapchat, Xigua, and Oasis. Recognition is not a production support promise: a platform is
advertised as stable only when at least one reviewed, monitored provider meets its launch gate.

Each provider owns a runtime-validated manifest with platform-specific priorities, regions, timeout,
cost weight, and enabled state. The worker performs bounded sequential fallback and records every
sanitized attempt. See [the provider development guide](docs/provider-development.md).
Provider-specific reviews live under [`docs/providers`](docs/providers/).

## Quick start

Requirements: Node.js 20.9+, pnpm 11+, Docker with Compose.

```bash
pnpm install
pnpm dev
# In a second terminal after the ready URL is printed:
pnpm smoke:local
pnpm dev:stop
```

Private owner console:

```powershell
pnpm db:migrate
.\admin-account.cmd init --username owner
pnpm admin:dev
pnpm admin:status
```

Open `http://localhost:3001/login`; `pnpm admin:stop` stops only recorded TikDD Admin processes.

`pnpm dev` is the default offline profile. It starts exactly one Web, API, Worker, and Delivery
process tree, starts/checks PostgreSQL and Redis, applies migrations, verifies HTTP and Worker queue
readiness, and prints `http://localhost:3000/en`. A second start fails instead of selecting another
port. `pnpm dev:stop` terminates only the recorded TikDD process trees and leaves both Docker data
volumes running. The original `pnpm dev` terminal remains the stack supervisor and exits normally
after `pnpm dev:stop` removes its ownership state.

`scripts/docker.mjs` also discovers a per-user Docker Desktop installation on Windows when
`docker.exe` is not on `PATH`. Set `DOCKER_BIN` to override it.

For a separately authorized local technical pilot, set every gate in the current shell and name the
exact adapters before running `pnpm dev:pilot`. For example, PowerShell with an explicit local HTTP
proxy:

```powershell
$env:TIKDD_LOCAL_LIVE_AUTHORIZED = "true"
$env:TIKDD_PILOT_PROVIDERS = "twittersaver,ssstwitter"
$env:TWITTERSAVER_TERMS_APPROVED = "true"
$env:SSSTWITTER_TERMS_APPROVED = "true"
$env:SSSTWITTER_DELIVERY_AUDIT_APPROVED = "true"
$env:TIKDD_PILOT_PROXY_URL = "http://127.0.0.1:10808"
pnpm dev:pilot
```

The launcher ignores inherited proxy variables, generates delivery encryption material only in
memory for that launch, checks TLS egress to every selected provider page host, and never persists
the proxy, key, authorization flag, submitted URL, or provider response. This profile is a bounded
technical-test path, not production approval or public rollout permission. See
[the local pilot launcher record](docs/work-item-11-1-implementation.md).

Applications:

- Web: `http://localhost:3000/en` and `http://localhost:3000/zh-CN`
- API: `http://localhost:4000/health/live`
- Delivery: `http://localhost:4002/health/live`
- Cleanup: independent scheduled process; use `pnpm cleanup:start` in its deployment
- Canary: authorized, rollout-controlled scheduler; use `pnpm canary:start` only after review
- Evidence: independent UTC aggregator/restrictive evaluator; use `pnpm evidence:start` only with
  locked policy, deployment ownership, and the reviewed diagnostics credential boundary

Before public traffic, run `pnpm cleanup:dry-run` and `pnpm verify:cleanup`; see the
[cleanup operations guide](docs/cleanup-operations.md).
Authorized operational probes are documented in the [canary operations guide](docs/canary-operations.md).

## Quality gates

```bash
pnpm check
```

Pull requests run this command in CI. After a merge to `main`, GitHub publishes immutable Web,
Service, and Admin images tagged with the exact commit SHA. Production deployments use those
registry images and the lightweight checklist in
[MVP release process](docs/mvp-release-process.md); local Docker images are never production input.

For a bounded post-release view of public Beta health, run `pnpm beta:report` with the production
`DATABASE_URL` (optionally `--hours 1..168` and `--platforms x,instagram,tiktok`). It emits only aggregate
counts, rates, failure classes, and timestamps; it does not print URLs, task IDs, provider details,
or media data and performs no writes.

The production-shaped X pilot has an additional deterministic Docker gate:

```sh
pnpm verify:work-item-10
```

It runs migrations, fixture-only provider/routing/delivery/public-state contracts, audited rollout
and pilot controls, admission, circuit, canary-metadata, cleanup, and the full repository check. It
never runs a live provider canary. Longer calibration and evidence windows are optional diagnostic
tools under ADR-0020, not Beta launch prerequisites.

Work item 11 adds the privacy-safe evidence and evaluator gate:

```sh
pnpm verify:work-item-11
```

It verifies UTC replay, distinct-task collapse, sanitized delivery outcomes, restrictive-only
evaluation, expiring Redis Guard publication, protected aggregate diagnostics, cleanup, residue,
and the full repository check without live provider traffic.

The merged work item 11 engineering baseline, including deployment preflight and an explicit check
that real-time evidence is still pending, uses the single CI command:

```sh
pnpm verify:work-item-11-baseline
```

This command never contacts a real Provider or enables public traffic. Live checks occur only in the
bounded post-deploy smoke described by ADR-0020.

The internal deployment boundary is separately fail-closed. Its checked-in plan remains pending
until the personal deployment settings and Provider-use confirmations are supplied:

```sh
pnpm verify:work-item-11-5
pnpm preflight:internal
```

Only a fully ready preflight can create a short-lived runtime-bound attestation, and both API and
Worker require it before labeling tasks as internal evidence. See
[internal deployment preflight operations](docs/internal-deployment-preflight.md).

This runs formatting/lint checks, TypeScript checks, unit tests, and production builds.
With PostgreSQL and Redis available, `pnpm verify:work-item-9` additionally runs the complete
rollout, admission, health, cleanup, and canary Docker gate used by CI.
With local infrastructure and the API/worker running, `pnpm smoke:local` verifies an Instagram task
through the asynchronous mock route.

## Safety and product constraints

- Public task creation accepts a validated URL without a client acknowledgement step.
- The current live product consists of experimental X and Instagram Betas backed by `ssstwitter`
  and `savefromins` in `nl`, plus the owner-approved TikTok route backed by SnapTik Monster. Work
  Item 50 promotes TikTok to stable in the catalog and publishes its reviewed immutable landing-page
  snapshot to the sitemap after the release is deployed; no other Provider, Admin, or calibration
  profile is started by this promotion.
- Private, paid, DRM-protected, authenticated, or region-restricted media is out of scope.
- Public task/result pages are not an SEO surface.
- Real providers require a terms review, explicit allowlists, timeouts, circuit breakers, sanitized
  fixtures, and scheduled canary checks.
- Authorized live checks are isolated behind `TIKDD_CANARY_AUTHORIZED=true`; see
  [the canary authorization record](docs/providers/canary-authorization.md).
- The yt-dlp supported-sites list is discovery input, not an automatic allowlist or reliability
  guarantee.

See [SECURITY.md](SECURITY.md) for the URL-ingestion and proxy threat model.
