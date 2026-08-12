# TikDD Owner Console product design

## Product definition

TikDD Admin is the control plane for one personal-site owner. It is not only an operations
dashboard: it owns the safe configuration and publishing workflows needed to operate routes,
maintain the public platform catalog, publish multilingual content, and control technical SEO.

The console deliberately is not a generic CMS, a raw infrastructure console, or an adapter editor.
Page templates, Provider adapters, host allowlists, extraction logic, and security policy remain
code-owned. The Admin owns validated business configuration and versioned published content.

## Product goals

- Let the owner understand service health and route quality without shell access.
- Configure bounded Provider routing with previews, revisions, propagation checks, and rollback.
- Maintain a catalog of supported platforms without weakening URL/host validation.
- Add locales and publish useful localized pages through structured content models.
- Configure page-level SEO while preserving non-indexable task, result, delivery, and Admin routes.
- Keep public Web, Admin, control-plane API, workers, and media delivery independently deployable.

## Non-goals

- Teams, roles, invitations, reviewer queues, or compliance/audit-center features.
- Editing arbitrary JSON, JavaScript, HTML, SQL, Provider responses, secrets, or environment files.
- Editing Provider adapters, upstream request headers, delivery allowlists, or platform host rules.
- Searching raw submitted URLs, task IDs, media candidates, cookies, or download credentials.
- Automatically generating thin platform pages or unreviewed bulk translations.

## Information architecture

The selected Routing Observatory remains the visual foundation. Navigation expands into seven
product areas grouped by the owner's operating loop.

| Group | Area | Primary decision |
| --- | --- | --- |
| Home | Overview | What needs attention today? |
| Operate | Routing Observatory | Which exact route is degraded, and why? |
| Operate | Alerts | Which current condition needs an owner action? |
| Configure | Provider routing | Which eligible Provider should receive traffic for a platform and region? |
| Configure | Platforms | Which platforms are technically recognized and publicly presented as supported? |
| Publish | Pages and locales | What localized content is drafted, missing, or published? |
| Publish | SEO | Which indexable pages are valid for canonical, hreflang, sitemap, and search snippets? |
| System | Settings | Is the site, deployment, authentication, and publication pipeline configured correctly? |

Mobile navigation uses a drawer with the same grouping. Desktop uses the existing left rail.
Route monitoring remains dense and operational; editing surfaces use calmer forms, side-by-side
previews, and a persistent validation summary.

## Core product objects

### Provider

A Provider is an adapter implementation plus a runtime-validated manifest. The Admin displays its
identity, capability, eligible regions, health, and effective route state. Adapter implementation,
base capability, upstream timeout, cost weight, delivery mode, and host allowlists are code-owned.

### Route policy

A route policy is versioned configuration for an exact Provider/platform/region tuple. It can own:

- staged traffic allocation and explicit pause/deny;
- effective ordering among manifest-eligible Providers;
- bounded concurrency overrides where supported;
- a preconfigured canary schedule and current probe state.

The Provider manifest remains the eligibility and fallback baseline. Admin configuration can narrow
or order eligible routes; it cannot make an unsupported Provider eligible or bypass circuit,
delivery, host, or rollout safety. Sequential bounded fallback remains mandatory.

### Platform

A Platform is identified by a catalog slug. The Admin displays the code-owned host rules and
extractor/provider coverage, but edits only presentation and release state: public display name,
support status, visibility, page association, and localized descriptive content. Host rules,
spoof-host tests, extractor keys, and URL-recognition behavior remain code-reviewed.

### Locale

A locale has a validated BCP 47 tag, display name, text direction, fallback locale, enabled state,
and publication state. `en` and `zh-CN` are initial seeded records, not a permanent closed enum.
The default locale cannot be disabled, and a locale with published indexable pages cannot be
removed without first unpublishing or migrating them.

### Page

A Page has a code-owned template type and one localized revision per locale. Initial page types are:

- homepage;
- platform landing page;
- help/guide page;
- FAQ page;
- legal page.

Content is stored as validated structured fields and safe Markdown where required. There is no raw
React, HTML, script, or arbitrary component editing. Each locale revision progresses through
`draft`, `ready`, `published`, or `archived`.

### SEO configuration

SEO configuration belongs to a localized page revision and includes:

- stable locale slug;
- search title and meta description;
- social title, description, and approved image reference;
- indexability and sitemap inclusion where the page type permits them;
- same-origin canonical resolution and hreflang group membership;
- an optional redirect from a previously published local slug.

Robots protection for tasks, results, delivery, API, and Admin routes is immutable. Canonicals and
redirect targets are validated as same-origin paths. Sitemap and hreflang are derived from published
eligible pages rather than edited as arbitrary XML.

### Published snapshot

Publishing produces an immutable versioned snapshot consumed by the public Web. Drafts and Admin
state never leak to public routes. A publish operation validates content, locale, platform
eligibility, canonical/hreflang, redirect collisions, and indexability before atomically promoting
the snapshot and revalidating only affected public paths.

## Configuration ownership matrix

| Configuration | Admin behavior | Source of truth |
| --- | --- | --- |
| Provider adapter and ID | Read-only | `@tikdd/providers` code |
| Provider capability and base priority | Read-only baseline | validated Provider manifest |
| Provider host/delivery allowlists and upstream headers | Hidden/read-only status | code and secret configuration |
| Route order, allocation, pause/deny, bounded concurrency | Versioned edit, preview, publish, rollback | control-plane persistence |
| Platform slug and explicit host rules | Read-only | `@tikdd/platform` code |
| Platform public status and presentation | Versioned edit | platform publication config |
| Locale registry | Validated edit | editorial persistence |
| Page templates and field schemas | Read-only | Web/content schema code |
| Localized page copy and SEO fields | Draft, preview, publish, rollback | editorial persistence |
| Robots protection for dynamic/private routes | Immutable | Web code and edge rules |
| Sitemap, canonical, hreflang, redirects | Derived/validated configuration | published snapshot |
| Secrets, tokens, cookies, raw Provider payloads | Never exposed | runtime secret stores |

## Primary workflows

### Change a Provider route

1. Select a platform and region; see eligible Providers, manifest base order, current health, and
   effective policy.
2. Create a draft order/allocation change. The UI explains fallback impact and refuses ineligible
   Providers, duplicate order entries, unbounded allocation, or unsafe concurrency.
3. Preview the effective route plan against the current revision and recent health.
4. Confirm the exact scope and reason, then publish with an idempotency key and expected revision.
5. Reload authoritative PostgreSQL/Redis state and show propagated, conflicted, or failed.
6. Allow rollback to the previous policy revision. Rollback is a new revision, not history deletion.

Emergency stop is a separate fast path that creates an exact deny. Resume only deactivates the
Admin-created deny; it never creates a grant or increases allocation.

### Add a locale

1. Create a validated locale and choose its fallback and text direction.
2. Complete required shared navigation, homepage, legal, and SEO defaults.
3. Review a coverage matrix that distinguishes missing, fallback, draft, ready, and published.
4. Preview desktop and mobile at the locale URL.
5. Publish the locale only when required pages and canonical/hreflang validation pass.

### Publish a platform page

1. Select a code-recognized platform and review Provider coverage and current health.
2. Create localized content using the platform-page schema.
3. Configure local slugs and search/social snippets, then preview the rendered page.
4. Publish only when the platform is stable, at least one monitored production route is eligible,
   and every required SEO validation passes.
5. Automatically include eligible locales in canonical, hreflang, and sitemap output.

### Update content or SEO

1. Edit a draft without affecting the published site.
2. See field-level validation, search/social previews, locale coverage, and affected paths.
3. Compare the draft with the current published revision.
4. Publish atomically, confirm revalidation, and retain one-click rollback to a prior revision.

## Screen specifications

### Overview

Shows deployment freshness, task/queue and delivery aggregates, active route incidents, unpublished
configuration changes, locale coverage gaps, and SEO blockers. It does not expose raw task or media
data. Every card links to one concrete decision surface.

### Routing Observatory

Keeps the approved topology and health visual language. It supports exact tuple selection, bounded
time windows, readable insufficient-data/stale states, and links to the matching route policy.
Traffic mutations are never embedded as ambiguous icon-only controls.

### Provider routing

Uses a platform/region matrix and a detail editor. The editor distinguishes:

- manifest baseline;
- current published policy;
- proposed draft;
- calculated effective order after rollout, circuit, and concurrency checks.

Publish, discard, rollback, and emergency deny are explicit actions. Conflicts reload the current
revision instead of silently overwriting it.

### Platforms

Lists catalog status, recognized hosts, Provider coverage, route health, locale coverage, page
publication, and SEO readiness. Security-sensitive host rules are visibly code-owned and link to
developer documentation rather than an edit form.

### Pages and locales

Uses a page-by-locale coverage matrix, filterable by type and status. The editor provides structured
fields, preview, draft/published comparison, validation, and an affected-path summary. Fallback copy
is visibly marked and never silently published as a completed translation.

### SEO

Provides an issue-first overview and a page editor. Checks include title/description completeness,
slug collision, canonical validity, hreflang completeness, platform-page eligibility, redirect
loops, indexability conflicts, structured-data eligibility, and sitemap membership. Technical
robots rules and generated XML are previewable but not freely editable.

### Settings

Contains site identity/default social metadata, locale registry, safe publication settings, and
read-only deployment/authentication/dependency readiness. Secret values are never rendered; only
configured/missing states are shown.

## Shared interaction and safety rules

- Read state distinguishes `healthy`, `warning`, `open`, `paused`, `insufficient_data`, `stale`,
  `unavailable`, and `draft`; missing data is never presented as zero or healthy.
- All mutations use exact scopes, server validation, expected revisions, idempotency keys, and
  authoritative post-action verification.
- Content and routing changes are drafts until explicitly published. Preview never mutates live
  state.
- Destructive or traffic-impacting actions name the affected platform, Provider, region, locale, or
  path in the confirmation copy.
- Admin responses and browser storage exclude submitted URLs, task IDs, media candidates, direct
  URLs, cookies, headers, secrets, and raw upstream responses.
- Admin is authenticated, same-origin, `no-store`, and `noindex`. The browser never receives the
  internal diagnostics bearer tokens.
- Every editing experience is keyboard usable, preserves focus after validation, and exposes
  errors next to fields plus in a summary.

## Release scope

### Foundation release

Authenticated Admin shell, overview, real Routing Observatory reads, Alerts, and safe deployment
readiness. This proves the control-plane boundary before configuration changes are enabled.

### Routing release

Provider route policy drafts, staged allocation, order, deny/resume, bounded probes, propagation
verification, rollback, and the Platforms overview.

### Publishing release

Locale registry, structured page revisions, preview, publication snapshots, rollback, and public
Web content loading.

### SEO release

Page SEO configuration, canonical/hreflang, redirect safety, sitemap derivation, technical previews,
and platform-page eligibility checks.

## Product success criteria

- The owner can diagnose and safely change an exact route without editing configuration files.
- Adding a locale requires no new locale enum or duplicated Web page implementation.
- No draft or unpublished SEO state appears on the public site.
- A platform page cannot be indexed before catalog, Provider, content, and SEO eligibility pass.
- Route, content, and SEO publication can be verified and rolled back without deleting history.
- No Admin feature weakens URL recognition, delivery allowlists, sequential fallback, or public
  result privacy boundaries.
