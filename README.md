# TikDD

TikDD is a multilingual, provider-agnostic public media resolver. A user submits a recognized public
page URL, the control plane creates an asynchronous task, and a worker routes through eligible
providers in priority order until one returns valid normalized metadata and formats. A separate
delivery service turns reviewed internal candidates into controlled browser delivery.

The local scaffold uses a development-only mock provider. TwitterSaver and SSSTwitter have
delivery-verified X redirect capabilities; DLPanda has multi-platform resolution-only capabilities.
All real adapters remain behind deployment enablement, approval, rollout, region, health, and
delivery gates. Candidate URLs stay encrypted server-side and opaque one-use tickets redirect only
to reviewed exact media hosts. Proxying, temporary files, and media downloads by TikDD remain
disabled.

## Architecture

```text
Web (SEO/UI) -> API -> platform catalog -> Redis queue -> resolver worker
                    |                              |
                    +---- PostgreSQL <--- provider router -> adapters

Selected format -> delivery service -> redirect / controlled proxy / temporary object
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
- The current public product is an experimental X-only Beta backed by `ssstwitter` in `nl`.
- Private, paid, DRM-protected, authenticated, or region-restricted media is out of scope.
- Public task/result pages are not an SEO surface.
- Real providers require a terms review, explicit allowlists, timeouts, circuit breakers, sanitized
  fixtures, and scheduled canary checks.
- Authorized live checks are isolated behind `TIKDD_CANARY_AUTHORIZED=true`; see
  [the canary authorization record](docs/providers/canary-authorization.md).
- The yt-dlp supported-sites list is discovery input, not an automatic allowlist or reliability
  guarantee.

See [SECURITY.md](SECURITY.md) for the URL-ingestion and proxy threat model.
