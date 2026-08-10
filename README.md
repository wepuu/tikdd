# TikDD

TikDD is a multilingual, provider-agnostic public media resolver. A user submits a recognized public
page URL, the control plane creates an asynchronous task, and a worker routes through eligible
providers in priority order until one returns valid normalized metadata and formats. A separate
delivery service turns reviewed internal candidates into controlled browser delivery.

The current scaffold uses a development-only mock provider. TwitterSaver and DLPanda adapters have
fixture coverage and bounded live canaries but remain disabled behind enablement and approval flags.
TwitterSaver has a redirect-only pilot: candidate URLs remain encrypted server-side and an opaque,
one-use ticket redirects only to its reviewed exact media host. Proxying, temporary files, and media
downloads by TikDD remain disabled.

## Architecture

```text
Web (SEO/UI) -> API -> platform catalog -> Redis queue -> resolver worker
                    |                              |
                    +---- PostgreSQL <--- provider router -> adapters

Selected format -> delivery service -> redirect / controlled proxy / temporary object
```

Start with [the architecture guide](docs/architecture/README.md),
[platform catalog](docs/platform-catalog.md), [routing policy](docs/routing-policy.md), and
[development roadmap](docs/development-plan.md). The immediate delivery order is in the
[next implementation plan](docs/next-implementation-plan.md). Read the
[ADR index](docs/architecture/adr/README.md) before changing service boundaries.

## Platform and provider model

The initial catalog recognizes 22 platform families, including TikTok, YouTube, X, Instagram,
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
cp .env.example .env
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm dev
pnpm smoke:local
```

`scripts/docker.mjs` also discovers a per-user Docker Desktop installation on Windows when
`docker.exe` is not on `PATH`. Set `DOCKER_BIN` to override it.

Applications:

- Web: `http://localhost:3000/en` and `http://localhost:3000/zh-CN`
- API: `http://localhost:4000/health/live`
- Delivery: `http://localhost:4002/health/live`
- Cleanup: independent scheduled process; use `pnpm cleanup:start` in its deployment
- Canary: authorized, rollout-controlled scheduler; use `pnpm canary:start` only after review

Before public traffic, run `pnpm cleanup:dry-run` and `pnpm verify:cleanup`; see the
[cleanup operations guide](docs/cleanup-operations.md).
Authorized operational probes are documented in the [canary operations guide](docs/canary-operations.md).

## Quality gates

```bash
pnpm check
```

The production-shaped X pilot has an additional deterministic Docker gate:

```sh
pnpm verify:work-item-10
```

It runs migrations, fixture-only provider/routing/delivery/public-state contracts, audited rollout
and pilot controls, admission, circuit, canary-metadata, cleanup, and the full repository check. It
never runs a live provider canary. The external three-day calibration and seven-day evidence remain
a separate operational gate.

This runs formatting/lint checks, TypeScript checks, unit tests, and production builds.
With PostgreSQL and Redis available, `pnpm verify:work-item-9` additionally runs the complete
rollout, admission, health, cleanup, and canary Docker gate used by CI.
With local infrastructure and the API/worker running, `pnpm smoke:local` verifies an Instagram task
through the asynchronous mock route.

## Safety and product constraints

- Users must confirm they own the content or have permission to download it.
- Private, paid, DRM-protected, authenticated, or region-restricted media is out of scope.
- Public task/result pages are not an SEO surface.
- Real providers require a terms review, explicit allowlists, timeouts, circuit breakers, sanitized
  fixtures, and scheduled canary checks.
- Authorized live checks are isolated behind `TIKDD_CANARY_AUTHORIZED=true`; see
  [the canary authorization record](docs/providers/canary-authorization.md).
- The yt-dlp supported-sites list is discovery input, not an automatic allowlist or reliability
  guarantee.

See [SECURITY.md](SECURITY.md) for the URL-ingestion and proxy threat model.
