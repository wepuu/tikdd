# Work item 12.6 implementation — locale registry and structured content

## Outcome

TikDD now has a versioned editorial foundation for an open multilingual catalog without turning
Admin into a generic CMS. `en` and `zh-CN` remain seeded records, while future canonical BCP 47
locales can be added without changing a frontend enum.

## Delivered boundaries

- Strict locale commands cover display name, direction, fallback, enabled/default state, and
  draft/ready state with exact confirmation, expected revision, reason, and idempotency.
- Code-owned definitions cover homepage, platform, guide, FAQ, and legal templates. A page draft
  must match its definition, locale, platform association, and discriminated structured schema.
- Safe Markdown rejects raw HTML, inline remote images, absolute remote links, and unsafe URI
  schemes. Draft SEO is forced non-indexable and outside sitemap.
- Shared locale blocks cover navigation, footer, and legal notice through a fixed schema and
  versioned persistence.
- PostgreSQL retains immutable locale, page, and shared-content revisions with independent head,
  draft, and published pointers. Discard removes only the draft pointer.
- The Admin API exposes one composed content-management view and bounded locale/page/shared draft
  commands behind the existing owner authentication, exact Origin, CSRF, and privacy boundary.
- The Admin UI presents a Locale register, explicit fallback chain, Page × Locale coverage matrix,
  and structured-content boundary. Fallback is visually distinct and never counted as translated.

## Safety rules

- The published default locale cannot be disabled or demoted through a draft.
- Fallback references must exist and the complete registry must remain cycle-free.
- New page IDs and page type/platform relationships come from code definitions only.
- Missing and fallback content remain distinct from `ready` and `published` coverage.
- No draft is loaded by the public Web application in this work item.

## Verification

- `pnpm test:work-item-12-6` passes 8 files / 35 tests.
- `pnpm check` passes repository text checks, all workspace type checks, 58 files / 251 tests, and
  every production build.
- Migration `0014_structured_content_model.sql` applied and reran idempotently against local
  PostgreSQL.
- Actual desktop and 375 CSS-pixel mobile rendering was checked. The document and Locale assembly
  panel have no horizontal overflow; switching to `zh-CN` shows the explicit `zh-CN → en` chain;
  browser console reports no warning or error.
- Browser QA performed no mutation and sent no Provider or media request.

## Deferred to 12.7

This work item establishes safe drafts and their coverage model. Field-by-field content editing,
diff, real-template preview, atomic snapshot publication, revalidation receipts, unpublish, and
rollback remain part of work item 12.7.
