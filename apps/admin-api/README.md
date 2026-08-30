# TikDD Admin API

Private, same-origin browser API for the personal owner console defined by
[ADR-0010](../../docs/architecture/adr/0010-owner-control-plane-routing-and-publication.md).

## Current scope (through work item 12.10)

- Loopback-only listener behind the reviewed Cloudflare Tunnel and Nginx boundary.
- One PostgreSQL-backed administrator account with scrypt password verification.
- Opaque Redis-backed sessions, bounded login throttling, credential-version revocation, and
  fail-closed authentication when PostgreSQL or Redis is unavailable.
- Independent origin-proof verification before accepting Admin BFF authentication or control-plane
  requests; the proof never reaches the browser.
- Exact Host/Origin and fetch-site checks, future mutation CSRF primitives, strict security headers,
  no-store, and noindex.
- Sanitized overview, route, Provider, platform, runtime, locale, page, and SEO endpoints.
- Explicit partial-dependency states and bounded source timeouts.
- Effective allocation uses the same rollout and Pilot Guard fail-closed semantics as the Worker.

Route-policy writes are limited to draft/publish/discard/rollback, narrowing concurrency,
zero-allocation deny/resume, and one preconfigured bounded probe. They require exact confirmation,
CSRF, idempotency, and expected revisions. This application does not proxy `/internal/v1/*`, accept
submitted URLs, expose raw tasks/media, or receive Provider credentials.

Platform-management reads compose the catalog and Provider manifests with sanitized operational
and publication state. Presentation writes are limited to public name, support label, visibility,
and an existing same-platform page association. A `listed` publication must pass the current
catalog, route, locale, page, and SEO readiness gate; Admin cannot edit hosts, extractors, adapter
capability, route eligibility, or delivery allowlists.

Content management uses an open canonical BCP 47 Locale registry, code-owned page definitions,
strict structured content, Safe Markdown, and versioned locale/page/shared-block drafts. Fallback
content is explicit and cannot satisfy translation readiness. Public Web still reads no draft.

The private SEO preflight derives canonical/hreflang/sitemap/redirect state from a complete candidate
and rejects private paths, collisions, redirect graphs, unsafe slug migrations, and ineligible
platform pages before immutable publication. It never accepts arbitrary canonical URLs or robots,
XML, remote social URLs, or JSON-LD.

Publication uses a bounded HMAC-authenticated acknowledgement to the public Web. The command carries
only a named immutable snapshot and validated local paths. Web reads the candidate independently,
and the durable active head advances only after a matching acknowledgement.

Settings and recovery reuse the existing Locale/shared-content revisions and immutable snapshot
pipeline. Recovery can only retry the latest failed acknowledgement, rebuild the current active
snapshot, revalidate that snapshot's persisted affected paths, or roll back to a known propagated
revision. Infrastructure is read-only and secrets render only as configured/missing.

## Local development

Set `ADMIN_AUTH_MODE=password`, `ADMIN_ORIGIN=http://localhost:3001`, and keep
`ADMIN_API_HOST=127.0.0.1`. PostgreSQL owns administrator credentials and Redis owns expiring
session digests and login throttling. Either store being unavailable fails closed.

```bash
pnpm dev:admin-api
```

Local direct requests must preserve the configured Admin Host. The Admin frontend connects through
its same-origin server boundary and forwards the opaque session only from its server-side BFF.

## Verification

Run `pnpm test:work-item-12-2`. The suite uses local keys and in-process requests only; it sends no
Provider request and does not require Cloudflare. Production startup remains impossible unless the
origin proof, HTTPS origin, and CSRF/command secrets are configured explicitly.

For production deployment design, Admin API must remain loopback-only. Separate ordinary Docker
containers do not share loopback; see `docs/work-item-16-deployment-design.md` for the proposed
shared-network-namespace pattern. That proposal is not implemented until Phase B is approved.
