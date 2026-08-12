# Work item 12.2 implementation — authenticated Admin API foundation

## Outcome

TikDD now has a dedicated, read-only `apps/admin-api` service for the personal owner console. It is
separate from the public API, resolver workers, delivery service, and public Web application. The
service exposes only runtime-validated and sanitized Admin projections; it cannot accept source URLs,
proxy internal endpoints, or mutate control-plane state.

## Security boundary

- The service listens only on `127.0.0.1` or `::1`.
- Production startup requires Cloudflare Access mode, HTTPS Admin origin, issuer, audience, remote
  JWKS URL, exact owner subject, independent Nginx origin proof, and a separate CSRF secret.
- Access assertions are verified for signature, allowed algorithm, issuer, audience, lifetime, and
  exact owner subject. The assertion is trusted only after the independent origin proof passes.
- Requests are constrained by exact Host, Origin, and fetch-site checks. All `/admin/v1/*` routes are
  GET-only in this work item.
- Responses use `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, deny-all CSP, frame
  denial, MIME sniffing protection, and restrictive referrer/permissions policies.
- Development auth is explicit, loopback-only, and rejected whenever `NODE_ENV=production`.
- A short-lived, subject-and-origin-bound HMAC CSRF primitive is ready for the later mutation work;
  no mutation or token-minting endpoint exists yet.

## Read model

The API exposes overview, exact route summary/detail, Provider manifest projections, platform
catalog projections, dependency/runtime freshness, locale revisions, page revisions, and SEO
summaries. Reads are independently time-bounded. A failing source becomes an explicit degraded or
unavailable state instead of a fabricated healthy value.

Effective route allocation is calculated from the code-owned manifest, published rollout snapshot,
and current Pilot Guard. A required missing, stale, expired, or unreadable guard fails closed. Route
health is composed from sanitized circuit and attempt aggregates; no submitted URL, task identifier,
candidate URL, upstream payload, credential, header, or network identifier crosses the boundary.

## Endpoint surface

- `GET /admin/v1/overview`
- `GET /admin/v1/routes`
- `GET /admin/v1/routes/:providerId/:platform/:region`
- `GET /admin/v1/providers`
- `GET /admin/v1/platforms`
- `GET /admin/v1/runtime`
- `GET /admin/v1/locales`
- `GET /admin/v1/pages`
- `GET /admin/v1/seo`

Health endpoints expose process readiness only. There is no wildcard proxy and no public OpenAPI
change.

## Verification

`pnpm test:work-item-12-2` covers production configuration refusal, Access JWT verification, exact
origin and host enforcement, direct-origin proof, CSRF binding, mutation rejection, internal proxy
rejection, privacy-output denial, contract parsing, partial dependencies, and rollout/Pilot Guard
composition. `pnpm check` remains the repository handoff gate.

Verification on 2026-08-11 passed with 7 focused files and 21 tests. Repository `pnpm check` passed
50 files and 218 tests plus every workspace typecheck and production build. A bounded local smoke
against healthy Docker PostgreSQL/Redis returned the seeded published locales `en` and `zh-CN` and
reported the intentionally incomplete local runtime as `degraded`; no Provider request was sent.

## Deferred by design

The real Admin frontend integration and operational alert views belong to work item 12.3. Route
policy writes and publication remain disabled until work item 12.4 adds revision, idempotency,
confirmation, CSRF, propagation, and rollback gates.
