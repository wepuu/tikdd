# Work item 12.1 implementation — Admin contracts, persistence, and fixtures

## Outcome

Work item 12.1 implements the first code boundary from ADR-0010 without exposing an Admin API or
enabling runtime mutations. TikDD now has a dedicated internal contract package, durable revision
schema, read-only persistence adapter, seeded locale registry, and reusable UI/test fixtures.

Public `@tikdd/contracts` and `openapi/tikdd.v1.yaml` are unchanged.

## Internal contract package

`@tikdd/admin-contracts` owns:

- overview, dependency, route summary/detail, Provider projection, and platform projection schemas;
- route-policy revision, concurrency-cap, mutation-receipt, and manifest eligibility validation;
- canonical BCP 47 locale revisions and fallback-registry validation;
- fixed homepage, platform, guide, FAQ, and legal content templates;
- safe Markdown, local SEO paths, approved asset references, page revisions, and immutable published
  snapshot schemas;
- defense-in-depth rejection of submitted/media URLs, task/delivery capabilities, credentials, raw
  Provider payloads, network identifiers, and stack traces;
- healthy, empty, stale, partial, high-volume, open, paused, insufficient-data, unavailable,
  long-label, RTL, incomplete-locale, page, route-policy, and published-snapshot fixtures.

All object schemas are strict: unknown fields fail validation instead of being silently stripped.
Route eligibility validation accepts only an existing catalog platform and an enabled,
non-development manifest capability in the concrete region. Optional concurrency caps cannot exceed
a code-owned maximum.

## Persistence boundary

Migration `0011_owner_control_plane.sql` adds 11 tables:

- immutable route-policy revisions and mutable head pointers;
- immutable platform-presentation revisions and head pointers;
- immutable locale revisions and head pointers;
- immutable localized page revisions and head pointers;
- immutable published content snapshots and the active deployment pointer;
- expiring command receipts containing only HMAC digests and bounded revision metadata.

The migration seeds reviewed `en` and `zh-CN` locale revisions. It stores no page draft, route
grant, secret, source/task/media value, or published snapshot. JSON columns remain behind the
runtime schemas; database checks still enforce object/array shape, limits, IDs, state values, and
revision relationships.

`AdminControlPlaneReadRepository` exposes only:

- one draft or published route-policy revision for an exact platform/region;
- current draft or published locale revisions;
- current draft or published localized page revisions;
- the active published snapshot after checking that database envelope ID, deployment, revision,
  and content hash match the validated payload.

No write repository or browser endpoint is enabled in this work item.

## Verification

- `@tikdd/admin-contracts` typecheck: passed.
- `@tikdd/persistence` typecheck: passed.
- Work-item contract/migration/read tests: 3 files, 10 tests passed.
- PostgreSQL migrations `0001` through `0011`: applied successfully.
- A second complete migration run: passed, proving the new migration is rerunnable.
- Live database inspection: 11 `admin_*` tables, 15 foreign keys, and the expected `en` default plus
  `zh-CN` published seed.
- Docker PostgreSQL and Redis were healthy during verification.

## Deferred by design

- Cloudflare Access authentication and `apps/admin-api` belong to work item 12.2.
- Operational aggregation and real Admin reads belong to work item 12.3.
- Route-policy writes, rollout publication, Redis compilation, and probes belong to work item 12.4.
- Content editing, snapshot publication, and Web loading belong to work items 12.6–12.9.

## Next step

Implement work item 12.2 against these schemas and read repositories. Keep all production Admin
startup paths fail-closed until Access issuer, audience, owner subject, origin, and trusted tunnel
configuration are complete.
