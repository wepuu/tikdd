# ADR-0010: Owner control plane, route-policy overlay, and content publication

- Status: Accepted
- Date: 2026-08-11
- Scope: work item 12 owner control plane
- Extends: ADR-0004, ADR-0006, ADR-0007, ADR-0008, and ADR-0009

## Context

TikDD has separate public Web, control API, resolver Worker, and delivery boundaries. Provider
manifests define code-reviewed capabilities and static priorities; PostgreSQL-backed rollout rules
authorize production traffic; Redis distributes expiring rollout, guard, and circuit snapshots;
and protected endpoints expose sanitized operational aggregates.

The current `apps/admin` application is a non-indexable Routing Observatory prototype backed by
demonstration data. It has no production authentication, dedicated browser-facing API, durable
content model, or mutation boundary. Public locale copy is currently code-owned and limited to the
seeded locales. Page metadata and sitemap behavior are generated in Web code.

The personal-site owner needs one control surface for operations, Provider routing, platform
presentation, multilingual content, and page SEO. Treating that surface as a generic configuration
editor would weaken several existing boundaries:

- an edited Provider capability or hostname could bypass manifest and catalog review;
- a route-order editor could accidentally become a new production-authorization source;
- a public Web dependency on Admin could make editorial or authentication failure an outage;
- an unrestricted SEO editor could index tasks, results, delivery paths, or thin platform pages;
- a browser-visible internal token, source URL, candidate, header, or payload could recreate the
  private resolve and delivery boundary in Admin.

TikDD therefore needs a decision-complete control-plane boundary before adding Admin APIs,
configuration persistence, or public content loading. The product remains for one owner. It does
not require teams, roles, approval queues, or a compliance audit product. Technical revisions and
change records are retained only to provide conflict detection, recovery, and rollback.

## Decision

### 1. Keep Admin, Admin API, public Web, and publication separate

`apps/admin` is the authenticated browser application. A new `apps/admin-api` is its only runtime
API. The Admin browser does not call the existing `/internal/v1/*` diagnostics routes and never
receives their bearer credentials.

`apps/admin-api` composes sanitized operational reads and owns validated owner commands. It does
not resolve submitted URLs, stream media, proxy arbitrary internal paths, execute shell commands,
or expose a general database/configuration editor.

The public `apps/web` does not call `apps/admin-api` and never reads drafts. It consumes only a
versioned published-content snapshot through a typed read boundary. Admin API failure therefore
cannot remove the last known-good public content, and public traffic cannot reach the Admin command
surface through an application dependency.

Admin contracts are runtime validated and remain outside `openapi/tikdd.v1.yaml` and
`@tikdd/contracts` public resolve/result models. Shared internal schemas may live in dedicated
packages, but they must not add Provider-native fields or downloadable URLs to a public contract.

### 2. Authenticate the owner at both the edge and the application

Production Admin traffic enters through Cloudflare Access and a private Cloudflare Tunnel to
Nginx. Nginx listens only on the private origin boundary for the Admin host, removes every
client-supplied identity/trust header, and forwards the Access assertion and normalized request
metadata to `apps/admin-api`. Direct public origin access is not supported.

`apps/admin-api` independently verifies the Access JWT signature, issuer, audience, expiry,
not-before time, and configured owner subject. An email claim may be displayed after validation but
is not the sole authorization key. JWKS values may be cached only for a bounded lifetime; a missing
or unverifiable key fails closed after that lifetime. A valid Cloudflare edge connection without a
valid owner assertion is unauthorized, and a valid-looking header arriving outside the trusted
Nginx boundary is untrusted.

Development authentication is enabled only by an explicit `ADMIN_AUTH_MODE=development`, requires
a non-production environment, and binds the Admin and Admin API to loopback. Production startup
fails when Access issuer, audience, owner subject, Admin origin, or trusted proxy/tunnel settings
are absent or inconsistent.

Every response uses a restrictive CSP, `Cache-Control: no-store`, and
`X-Robots-Tag: noindex, nofollow, noarchive`. Admin pages also emit robots metadata. Authentication
assertions and CSRF material are never stored in local storage, session storage, URLs, analytics,
or application logs.

### 3. Require same-origin, anti-CSRF, idempotent commands

All state-changing endpoints accept JSON only and require:

- the authenticated owner subject;
- an exact configured Admin `Origin` and `Host`;
- same-site fetch metadata when the browser supplies it;
- a short-lived server-issued CSRF token bound to the owner session and Admin origin;
- an idempotency key, expected aggregate revision, exact target scope, and bounded reason;
- runtime request validation and a server-calculated effect preview.

GET and preview endpoints have no mutation side effects. A stale expected revision returns a
conflict and the current sanitized revision; it never applies a last-write-wins update. Repeated
idempotency keys with the same command return the original receipt, while a different command
returns a conflict. The UI never presents optimistic success: it reloads authoritative state and
shows accepted, propagating, propagated, conflicted, failed, or rolled back.

### 4. Split code-owned and owner-managed configuration

The ownership boundary is:

| Configuration | Owner-managed behavior | Authoritative source |
| --- | --- | --- |
| Provider ID, adapter, kind, capability, region, base priority, timeout, and cost | Read-only | validated Provider manifest |
| Provider host/delivery allowlists, upstream headers, and credentials | Never editable or exposed | code and secret configuration |
| Runtime allocation, pause/deny, bounded preference order, and supported concurrency cap | Draft, preview, publish, rollback | versioned control-plane persistence |
| Platform slug, explicit host rules, extractor keys, and recognition | Read-only | `@tikdd/platform` code |
| Platform display/support state, visibility, and page association | Draft, publish, rollback | versioned publication configuration |
| Locale registry, localized structured copy, and safe SEO fields | Draft, preview, publish, rollback | editorial persistence |
| Page templates, field schemas, robots invariants, and structured-data templates | Read-only | Web/content-schema code |
| Secrets, tokens, cookies, raw Provider payloads, source/task/media data | Never exposed | existing private runtime boundaries |

Admin configuration may narrow an existing code boundary. It cannot create a Provider, platform
slug, host rule, adapter capability, region, delivery mode, or credential. Those changes continue
to require code review, runtime manifest/catalog validation, fixtures, spoof-host tests, and the
existing deployment process.

### 5. Add a route-policy overlay without creating a second authorization source

The route-policy aggregate is keyed by `(platform_slug, concrete_worker_region)`. Each immutable
revision may contain:

- an ordered list of manifest-eligible Provider IDs;
- references to the exact rollout rules that provide allocation or denial;
- optional per-route concurrency caps bounded by code-owned maxima;
- a bounded reason, opaque owner subject, timestamps, and previous revision.

The ordered list is a preference overlay, not eligibility. Providers omitted from the list retain
their manifest order after explicitly listed Providers unless an existing rollout deny/allocation
rule makes them ineligible. A policy cannot mention an unknown Provider, unsupported platform,
ineligible region, disabled production manifest, development mock, or duplicate Provider. Empty or
absent preference order means the ADR-0004 manifest priority remains authoritative.

The Worker evaluates a route in this fixed order:

1. manifest enabled state, platform capability, region, production-safety, and route budget;
2. ADR-0007 rollout authorization and deny precedence;
3. ADR-0008 restrictive guard and ADR-0006 circuit permission;
4. distributed concurrency permission;
5. published preference order, followed by manifest base priority and bounded health/latency/cost
   signals;
6. sequential bounded fallback and terminal/fallback error policy;
7. normalized result and delivery-policy validation.

No later step can override a denial from an earlier step. Route preference never closes a circuit,
raises a restrictive guard, authorizes an allocation, broadens a host, changes a timeout, or turns
sequential fallback into fan-out.

Publishing a route-policy revision validates it against the current manifest/catalog snapshot and
current rollout/guard revisions in one command. PostgreSQL remains authoritative. After commit, a
compiler publishes one versioned expiring Redis snapshot using compare-and-set; an older compiler
cannot replace a newer revision. Workers poll the durable revision as well as consuming change
notifications. Until the new snapshot is observed, the command is `propagating`, not successful.

If Redis is unavailable, the existing non-stale in-process/durable authorization rules apply. A
preference snapshot may fall back to manifest order, but a missing or stale affirmative rollout or
required guard continues to fail closed under ADR-0007/0008. A rollback is a new revision copied
from a previous policy; history is never deleted or rewritten.

Emergency deny bypasses the draft workflow but not validation. It writes the existing deny-first
rollout form for an exact reviewed scope and then verifies durable and Redis revisions. Resume may
only deactivate the exact Admin-created deny and reveal the already-authorized underlying policy;
it cannot create a grant, raise allocation, clear a guard, or close a circuit.

### 6. Use fixed structured editorial objects, not a generic CMS

PostgreSQL stores versioned editorial aggregates:

- a locale registry with validated BCP 47 tag, display name, direction, fallback, enabled state,
  and publication readiness;
- code-owned page definitions for homepage, platform, help/guide, FAQ, and legal templates;
- localized page revisions containing schema-validated structured fields and safe Markdown where
  the template allows it;
- shared navigation, footer, and legal blocks;
- page-bound SEO fields and safe local redirects;
- immutable published snapshots and one active snapshot pointer per deployment.

`en` and `zh-CN` are initial seeded locale records, not a closed enum. The default locale cannot be
disabled. A locale with published indexable pages cannot be removed or repointed without first
publishing a safe unpublish or migration revision. Fallback content is allowed for preview and
non-indexable incomplete states but is visibly marked and cannot silently satisfy translation
readiness.

Page templates and field schemas remain code-owned. Editorial input cannot contain scripts,
iframes, event handlers, arbitrary React, arbitrary HTML, CSS, remote embeds, or arbitrary
structured data. Safe Markdown is parsed with a strict allowlist and rendered with escaping. Asset
references, when introduced, must point to an approved TikDD asset record rather than an arbitrary
remote URL.

### 7. Publish an immutable, validated snapshot for public Web

Publication follows these phases:

1. load the draft and current active revision with an expected revision;
2. validate content schema, locale readiness, platform eligibility, SEO, redirect collisions, and
   every affected path;
3. render/preflight affected public templates without exposing the draft publicly;
4. create an immutable snapshot with a content hash and atomically advance the PostgreSQL active
   pointer;
5. send a server-authenticated revalidation command containing snapshot ID and approved route keys,
   never an arbitrary URL;
6. wait for bounded Web acknowledgement and publish a propagation receipt.

The Admin reports `published` only after the active pointer and required Web acknowledgement match.
If revalidation fails after pointer promotion, the revision is `propagation_failed`; the previous
snapshot remains addressable, and an idempotent retry or explicit rollback restores a known state.
Public Web serves one complete snapshot per request and never mixes draft/current records inside a
render.

`apps/web` accesses published snapshots through a typed content loader using a read-only database
identity or an equivalently isolated internal read service. It does not use Admin credentials. Each
Web process retains a bounded last known-good snapshot cache. A bundled seed snapshot preserves the
current reviewed `en` and `zh-CN` homepage when a fresh process cannot reach the content store. A
stale snapshot raises protected readiness/alert state but does not expose drafts or turn an
editorial outage into an empty public site.

Rollback creates and promotes a new immutable snapshot based on a prior snapshot. It never mutates
or deletes the historical snapshot. Cleanup may remove expired non-active drafts and superseded
snapshots only under a later explicit retention policy; it cannot delete the active or configured
rollback-safe snapshot set.

### 8. Derive technical SEO from eligible published state

Owner-managed SEO fields are limited to localized slug, title, description, social title and
description, approved image reference, and page-type-permitted indexability. Canonical paths,
hreflang groups, sitemap membership, and redirects are derived and validated against the configured
public origin and active snapshot.

The following rules cannot be overridden from Admin:

- Admin, API, task, result, delivery, candidate, ticket, temporary-object, and internal routes are
  `noindex, nofollow, noarchive` and absent from sitemap;
- submitted URLs and media metadata never appear in public paths or generated SEO content;
- a platform page is indexable only when its catalog entry is `stable`, at least one monitored
  production Provider is eligible in the target region, and the locale content is ready;
- planned, experimental, paused, fallback-only, draft, archived, or validation-failed pages do not
  enter sitemap or hreflang;
- canonical and redirect destinations are normalized same-origin paths; collisions, chains, and
  loops fail publication;
- arbitrary XML, robots directives, canonical URLs, remote social images, or JSON-LD are not
  accepted. Structured-data templates remain code-owned and render only validated page fields.

A published slug change requires a validated previous-path redirect or an explicit safe retirement.
Sitemap and hreflang are generated from the same active snapshot as visible content, preventing
metadata/content revision drift.

### 9. Make failure and recovery explicit and bounded

Operational reads use bounded windows and distinguish `healthy`, `warning`, `open`, `paused`,
`insufficient_data`, `stale`, `unavailable`, and `draft`. Missing data is never converted to zero or
healthy. A failed read has no mutation side effect.

Route and publication commands use transactional durable writes followed by independently visible
propagation state. Database failure makes the command fail without publication. Redis failure never
invents authorization. Web acknowledgement failure never causes Admin to claim a completed
publication. Repeated retries are idempotent, and recovery operates only on a named command or
revision.

The allowed recovery actions are retry propagation, rebuild a known snapshot, revalidate approved
affected paths, publish an emergency deny, or roll back to a known revision. Admin does not provide
arbitrary cache purge, raw Redis manipulation, SQL, shell access, secret editing, or manifest
editing.

### 10. Keep Admin data sanitized and history technical

Admin schemas are allowlists. Responses, persistence, logs, traces, fixtures, browser storage, and
analytics must reject:

- submitted, canonical, target, redirect, or media URLs;
- task, candidate, format, ticket, caller, session, or network identifiers;
- media title, author, thumbnail, duration, or other result metadata;
- cookies, headers, tokens, secrets, DNS answers, Provider payloads, HTML captures, or stack traces;
- arbitrary free-form upstream errors.

Exact Provider/platform/region tuples, bounded aggregate metrics, normalized error classes,
configuration revisions, opaque command IDs, bounded reasons, owner subject, timestamps, and
propagation state are permitted where required.

Revision/change history is an internal reliability mechanism. It supports optimistic concurrency,
incident recovery, attribution of owner commands, and rollback. TikDD does not add a user-facing
audit center, reviewer role, approval workflow, or compliance export. The single authenticated
owner remains the only human authority; existing automated guards remain restrictive-only.

## Invariants

1. Admin and Admin API are private, authenticated, same-origin, `no-store`, and non-indexable.
2. Public Web reads only complete published snapshots and never depends on Admin API availability.
3. Provider manifests and platform host rules remain the hard capability and recognition boundary.
4. Route preference cannot grant traffic, bypass a deny/guard/circuit, broaden delivery, or enable
   an unsupported Provider/platform/region.
5. Provider fallback remains sequential, terminal-aware, attempt-bounded, and deadline-bounded.
6. PostgreSQL is authoritative for route and editorial revisions; Redis/cache entries are
   replaceable, expiring projections.
7. Every mutation uses owner auth, CSRF/origin checks, exact scope, idempotency, expected revision,
   server validation, and authoritative post-action verification.
8. Resume and automated recovery never create a grant or increase traffic.
9. Draft, fallback-only, ineligible, or partially propagated content never appears as a completed
   public publication.
10. Sitemap, canonical, hreflang, redirect, and visible content derive from one active snapshot.
11. Dynamic/private routes remain non-indexable regardless of owner-provided SEO fields.
12. Admin contracts, storage, logs, and browser state contain no submitted URL, task/media/delivery
    capability, credential, raw payload, or caller history.

## Rejected alternatives

### Expose the existing internal diagnostics routes directly to the browser

Rejected because it would place bearer credentials and service-oriented contracts in a browser and
mix operator UI concerns with existing internal endpoints. A dedicated Admin API owns browser-safe
composition and commands.

### Trust Cloudflare identity headers without application verification

Rejected because a reachable or misconfigured origin could accept spoofed headers. The application
verifies the signed assertion and owner subject, while the private tunnel removes the intended
direct-origin path.

### Let Admin edit Provider manifests, host rules, or delivery allowlists

Rejected because those values are executable security boundaries and require code review, fixtures,
spoofed-host tests, and deploy-time validation. Admin may only narrow or order eligible routes.

### Replace manifest priority with an arbitrary database list

Rejected because missing or corrupt control data could erase deterministic fallback intent and an
Admin entry could appear to grant capability. The preference overlay is optional; the manifest is
the validated baseline and unlisted eligible Providers retain manifest order.

### Make public Web query Admin API for every page

Rejected because authentication/control-plane failure would become a public outage and drafts could
cross the wrong boundary. Web consumes only immutable published snapshots through a read-only
content boundary.

### Store content as arbitrary HTML or use a generic page builder

Rejected because arbitrary markup expands XSS, SEO, accessibility, and template compatibility risk.
TikDD uses fixed page types, structured schemas, and strictly sanitized Markdown.

### Make robots, canonical, sitemap XML, or JSON-LD freely editable

Rejected because one configuration mistake could index private/dynamic paths, create cross-origin
canonicals, or publish misleading structured data. Technical SEO is derived from eligible published
state and code-owned invariants.

### Auto-publish translations or every yt-dlp extractor page

Rejected because it creates thin, unreviewed pages and turns extractor discovery into unsupported
product claims. Locale readiness and stable platform/provider eligibility remain publication gates.

### Add multi-user approval and audit workflows now

Rejected because TikDD is a personal site with one owner. Required revision metadata is a technical
safety mechanism, not justification for a separate organization/compliance product.

## Consequences

- Work item 12.1 adds internal schemas and persistence for route-policy overlays, locale/page/SEO
  revisions, immutable snapshots, and command receipts without changing public resolve contracts.
- Work item 12.2 creates `apps/admin-api` and production-failing authentication/origin checks.
- Work item 12.3 connects the existing visual baseline to sanitized real reads.
- Work items 12.4 and 12.5 add guarded route and platform controls while keeping manifests/catalog
  host rules code-owned.
- Work items 12.6 through 12.9 replace hardcoded locale copy with structured drafts and published
  snapshots, then derive public SEO from that snapshot.
- Public Web needs a read-only content identity, last-known-good cache, bundled seed snapshot, and
  bounded revalidation acknowledgement.
- PostgreSQL gains additional configuration/editorial state; Redis continues to hold only
  replaceable runtime projections.
- A preference overlay adds configuration flexibility but also requires effective-policy previews,
  conflict tests, propagation monitoring, and rollback tests.

## Implementation and verification order

1. Define runtime-validated internal contracts, forbidden-field tests, fixtures, migrations, and
   repositories for route/editorial revisions and immutable snapshots.
2. Add owner authentication, origin/CSRF protection, production startup validation, and sanitized
   read-only Admin API endpoints.
3. Connect Overview, Routing Observatory, Alerts, Providers, and Platforms to real read models.
4. Implement route-policy draft/preview/publish, bounded probes, deny/resume, propagation, conflict,
   and rollback tests.
5. Add locale/page models, structured editors, preview rendering, immutable snapshot publication,
   and known-good recovery.
6. Add validated SEO fields, redirects, canonical/hreflang/sitemap derivation, and platform-page
   eligibility tests.
7. Move public Web to the typed published-content loader and verify failure/restart behavior.
8. Run the work-item 12 privacy, authentication, mutation, publication, SEO, responsive, Docker,
   and full `pnpm check` gate before deployment.

## Implementation status

Work item 12.0 accepted this boundary on 2026-08-11. It changes no runtime behavior, public API,
database schema, Provider eligibility, or deployment configuration. Work item 12.1 is the first
authorized implementation step.
