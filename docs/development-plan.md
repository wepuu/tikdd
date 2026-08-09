# TikDD development roadmap

The roadmap grows platform coverage through measured provider capabilities rather than promising
everything listed by an extractor project. A platform becomes indexable and advertised only after a
production provider meets its reliability and policy threshold.

## Milestone 0 — Extensible foundation (current)

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
- Build scheduled canaries that measure success rate, p50/p95 latency, available formats, link
  lifetime, geographic behavior, challenge rate, and estimated cost.
- Provider/platform/region aggregation, revisioned Redis circuit state, atomic half-open leases, and
  Router consumption are implemented behind an explicit versioned-policy gate.
- A development-only failure-injection adapter proves priority order, fallback, terminal stops, and
  route budget exhaustion without participating in production routing.

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
- Add a provider administration/read-only diagnostics surface for health, circuit state, priority,
  and recent sanitized failures.
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
