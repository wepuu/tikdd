# Work item 12.11 implementation — integrated verification and baseline

Completed on 2026-08-13.

## Outcome

`pnpm verify:work-item-12` is the deterministic closure gate for work items 12.0–12.10. It starts
the existing local PostgreSQL and Redis services, applies idempotent migrations, runs the integrated
Admin/Provider/content/SEO test set, verifies the distributed runtime controls, audits residue,
then executes `pnpm check` and repeats the residue audit after production builds.

The gate forces every live Provider and canary switch off and removes proxy variables. It makes no
Cloudflare request, no Provider request, no media request, and no public-video submission.

## Coverage matrix

| Boundary | Evidence in the gate |
| --- | --- |
| Admin authentication and transport | Password hashing/dummy verification, session expiry/revocation, origin proof, loopback-only API, Host/Origin, CSRF, CSP, `no-store`, `noindex`, production incomplete-configuration refusal |
| Runtime and privacy | Strict Admin schemas, forbidden-key/value rejection, partial-source behavior, freshness states, settings secret-presence projection |
| Provider routing | Manifest capability, platform consistency, production eligibility, manual order, bounded sequential fallback, concurrency, deny precedence, circuit/half-open recovery, Pilot Guard and Probe leases |
| Versioned Admin control | Optimistic conflicts, idempotency digests, projection propagation, route/platform rollback, resume-never-grants |
| Locale and content | Canonical BCP 47 registry, fallback-cycle rejection, structured templates, draft isolation, transactional snapshot promotion, active-pointer-after-acknowledgement, known-snapshot recovery |
| SEO and public Web | Slug/private-path checks, redirects, canonical, hreflang, sitemap, robots/security expectations, structured data, immutable active snapshots, known-good and bundled fallback |
| UI and accessibility | Healthy/partial/stale/high-volume/RTL/long-label fixtures, explicit accessible labels, focus visibility, reduced motion, reviewed desktop and 390×844 no-overflow evidence |
| Residue | Verification-pattern database rows, Redis keys, HAR files, cookie exports, storage-state and browser-session artifacts; administrator account rows and secret values are deliberately not inspected |

## Commands

```text
pnpm test:work-item-12
pnpm verify:work-item-12:residue
pnpm verify:work-item-12
```

The integrated command requires Docker Desktop to be running. It uses the repository defaults
`postgresql://tikdd:tikdd@localhost:5432/tikdd` and `redis://localhost:16379` unless explicit local
verification URLs are supplied.

## Baseline boundary

- No public OpenAPI or public resolve-result contract changed.
- No Provider, Cloudflare, Nginx, DNS, or deployment state is mutated.
- The existing administrator account and active sessions are not test fixtures and are not removed.
- Work item 12 can be committed as one independently verified pre-deployment baseline.
