# TikDD Admin

TikDD Admin is the private, non-indexable owner console. It stays outside `apps/web`, so public SEO
pages never depend on Admin authentication, monitoring, or control-plane availability.

## Current scope (through work item 12.8)

- Server-rendered initial data from the dedicated authenticated Admin API.
- One fixed same-origin `/api/admin/snapshot` route for bounded browser refreshes.
- Real overview, explainable operational-truth ladder, attention queue, Routing Observatory,
  Alerts, Provider/platform coverage, publishing readiness, and dependency freshness projections.
- Exact route selection and detail with honest healthy, paused, open, warning, stale,
  insufficient-data, unavailable, and empty states.
- Read-only navigation for the complete owner-console information architecture.

The browser never receives the Nginx origin proof, internal diagnostics tokens, submitted URLs,
task IDs, delivery candidates, upstream headers, or raw Provider responses. The Next server keeps
the opaque administrator token in an HttpOnly cookie and forwards it with its server-side origin
proof only to fixed Admin API routes over a loopback-only connection.

## Local development

Start PostgreSQL and Redis, apply migrations, initialize the account once, and use the controlled
preview launcher:

```bash
pnpm infra:up
pnpm db:migrate
.\admin-account.cmd init --username owner
pnpm admin:dev
pnpm admin:status
```

The default console URL is `http://localhost:3001/`. `ADMIN_AUTH_MODE=password` is mandatory and the
Admin API remains loopback-only. Use `pnpm admin:stop` to stop only the recorded TikDD process trees.

## Verification

Run `pnpm test:work-item-12-3`. Tests cover fixed-path forwarding, assertion/origin-proof handling,
real Host preservation over loopback, partial-resource behavior, alert derivation, read-only next
steps, document security headers, Admin API reads, and privacy contracts.

Work item 12.4 enables versioned route-policy drafts, publish/discard/rollback, narrowing concurrency
caps, exact deny/resume, and preconfigured bounded probes. Every command uses CSRF, exact
confirmation, an idempotency key, an expected revision, server-side manifest eligibility, and an
authoritatively verified PostgreSQL/Redis receipt. Resume only expires the exact Admin-created deny;
it never writes a grant.

Work item 12.5 adds catalog-owned platform management. The Platforms area distinguishes catalog
status, shows recognition and adapter facts as read-only, presents an explicit publication-
readiness runway, and limits edits to public presentation fields and a validated page association.

Work item 12.6 adds the Locale assembly line: an open Locale register, visible fallback provenance,
code-owned page definitions, Page × Locale coverage, and separate missing/fallback/draft/ready/
published states. Structured editing and publication continue in work item 12.7.

Work items 12.7 and 12.8 add the structured proofing desk, immutable two-phase publication, and a
Search index passport. Draft SEO intent is editable, while canonical, hreflang, sitemap,
structured-data templates, redirect safety, and platform eligibility remain derived and fail closed.
Work item 12.8.1 adds one PostgreSQL-backed administrator account and Redis sessions. Use
`pnpm admin:dev`, `pnpm admin:status`, and `pnpm admin:stop` for the controlled preview. Initialize
the account after migrations with `.\admin-account.cmd init --username owner` on Windows. The
`pnpm admin:account` form remains available in shells where pnpm is already on `PATH`.

Work item 12.10 adds versioned site identity, default social metadata, Locale publication defaults,
read-only infrastructure/secret-presence readiness, and recovery limited to exact known snapshots
and their persisted affected paths. It does not provide logs, arbitrary cache purge, SQL, shell, or
secret editing.
