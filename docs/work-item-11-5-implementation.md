# Work item 11.5 implementation record

Engineering status: complete on 2026-08-11. Deployment `tikdd`, region `nl`, and trusted
Cloudflare/Nginx ingress are selected, and the site owner confirmed production use of both X
Providers. Real runtime signals remain pending, so Pilot traffic remains disabled.

## Delivered

- A personal-site technical preflight validates deployment scope, Provider-use confirmation,
  runtime secrets, PostgreSQL/Redis, egress, scheduled jobs, emergency stop, restart and expiry.
- There is no Owner matrix, reviewer separation, audit dashboard, approval-reference store, or
  consumer-facing administration page.
- Ready results can issue only short-lived HMAC attestations bound to the exact runtime digest.
  Blocked or stale results cannot issue an attestation.
- API and Worker fail startup for internal observations without the same current attestation. API
  persists the server-selected `internal` class; idempotency replay cannot cross from public to
  internal evidence.
- Deterministic failure exercises run without deploying Web/API, contacting Providers, or enabling
  Pilot traffic.

## Verification

`pnpm verify:work-item-11-5` applies migrations, runs 46 focused tests, proves pending-plan refusal,
verifies internal/public admission isolation, exercises emergency deny, stale control, manual
recovery and cleanup against local PostgreSQL/Redis, confirms zero residue, then passes repository
lint, type checks, 196 tests in 42 files, and production builds.
