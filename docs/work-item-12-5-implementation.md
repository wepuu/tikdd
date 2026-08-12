# Work item 12.5 implementation — platform management

## Outcome

The private owner console now manages the public presentation of catalog-owned platforms without
turning the catalog into an editable registry. Recognition hosts, extractor keys, Provider
capabilities, delivery allowlists, and adapter behavior remain code-owned.

## Delivered boundaries

- `@tikdd/admin-contracts` defines strict platform presentation revisions, exact-scope commands,
  readiness blockers, and the composed management view.
- Migration `0013_platform_presentation_controls.sql` extends the existing presentation revision
  log with immutable draft, published, and rollback revisions. It stores public display fields and
  never stores recognition rules or adapter capability.
- `AdminPlatformPresentationRepository` applies optimistic revision checks, HMAC-only idempotency,
  immutable publication history, discard, and rollback-as-a-new-revision.
- `AdminPlatformManagementService` composes the code-owned platform catalog and Provider manifests
  with sanitized route, locale, page, SEO, and presentation state.
- Authenticated Admin API endpoints expose one exact platform/region view and bounded
  draft/publish/discard/rollback commands. Existing owner authentication, exact Origin, CSRF,
  confirmation, idempotency, and `no-store`/`noindex` controls apply.
- The Admin Platforms area distinguishes stable, experimental, planned, and paused catalog states,
  presents code-owned facts as read-only, and provides an explicit publication-readiness runway.

## Publication gate

An owner may prepare a hidden, preview, or paused draft while readiness is incomplete. Publishing a
`listed` presentation is revalidated against current state and requires:

1. a stable code-owned catalog entry;
2. at least one monitored, manifest-enabled, non-zero allocation route that is not open, paused, or
   unavailable;
3. an associated published platform page;
4. coverage for every enabled published locale; and
5. indexable, sitemap-eligible SEO on the associated pages.

Page association is limited to an existing platform page for the same catalog slug. A presentation
change cannot create hosts, add extractor keys, grant Provider support, alter route eligibility, or
change delivery behavior.

## Verification

- `pnpm test:work-item-12-5` passes 12 files / 74 tests covering contracts, migration boundaries,
  persistence, authenticated API reads/writes, catalog ownership, readiness decisions, Admin
  forwarding, platform spoof-host tests, and Provider routing contracts.
- `pnpm check` passes repository text checks, all workspace type checks, 57 files / 246 tests, and
  every production build.
- Migration `0013` applied successfully to the local PostgreSQL database and reran idempotently.
- The actual Admin application was checked at desktop and mobile widths. Platform selection, the
  status distinction, code-owned facts, readiness runway, and editor remained usable with no page
  overflow or browser console warning/error.
- Browser QA issued no Admin mutation and no live Provider request.

## Runtime impact

This work item does not change the public Web content loader, public resolve/result contracts,
Provider execution, URL recognition, or media delivery. Public page publication remains blocked
until the structured locale/content and immutable publication pipeline in work items 12.6–12.9 are
implemented.
