# Work item 12.7 — Content proofing and publication pipeline

Status: complete on 2026-08-12.

## Delivered

- Added a code-owned structured page proofing desk with locale/page selection, editable title and
  summary fields, draft/ready commands, and Safe Markdown/template validation at the server boundary.
- Added desktop/mobile previews built from the selected structured template and locale direction.
- Added draft-versus-active diff entries for page, locale, and shared content plus bounded affected
  paths and publication blockers.
- Added exact-deployment-confirmed publish, rollback-as-new-revision, and failed-propagation retry
  commands with expected revisions and idempotency receipts.
- Added migration `0015_content_publication_pipeline.sql` for sanitized actor/reason metadata,
  bounded affected paths, propagation attempts, and query indexing.
- Kept legacy snapshot payloads readable by defaulting the newly normalized shared-content array.

## Publication safety model

Publication is a two-phase promotion. The database first stores a complete immutable candidate in
`propagating` state and promotes only ready editorial heads. It does not update the active snapshot
head. A positive, bounded Web acknowledgement then atomically changes the active head and completes
the receipt. Failure marks the candidate `propagation_failed`, leaves the previous active snapshot
unchanged, and permits only the latest failed candidate to be retried. Rollback copies a prior
propagated payload, including SEO, into a new immutable revision and follows the same acknowledgement
boundary.

Work item 12.9 will provide the Web-side snapshot loader and acknowledgement adapter. Until that
adapter is configured, the Admin API intentionally returns a failed propagation receipt instead of
claiming publication success.

## Verification

- `pnpm test:work-item-12-7`: 7 files and 33 tests passed.
- Type checks passed for `@tikdd/admin-contracts`, `@tikdd/persistence`, `@tikdd/admin-api`, and
  `@tikdd/admin`.
- `pnpm db:migrate` completed twice against the Docker PostgreSQL instance; migration 0015 is
  repeatable.
- Browser QA passed at the default desktop viewport and at 390 × 844. The document has no global
  horizontal overflow; the long page/template index, publication film, and coverage matrix use
  explicit internal scrolling.
- Full repository lint, type checks, and all 254 tests passed; the first combined command reached
  the build phase but exceeded the 120-second command window, so the complete production build was
  rerun separately and passed for all 21 buildable workspace projects.

No live Provider request, public media URL, task data, cookie, or delivery credential was used.
