# ADR-0029: First-run code-owned content bootstrap

- Status: Accepted
- Date: 2026-09-11
- Scope: Work Item 38 first bilingual content snapshot
- Extends: ADR-0010, ADR-0028

## Context

The structured content and immutable publication pipeline is deployed, but a fresh deployment can
legitimately have locale registry rows with no page/shared revisions and no active snapshot. Web
therefore serves its bundled reviewed fallback while the owner has no concise way to seed the first
reviewable draft set. Manually constructing fourteen pages and two shared blocks is error-prone and
can create a second copy of the public seed.

## Decision

1. Keep the starter content code-owned and export typed factories from `@tikdd/admin-contracts`.
   Web's bundled fallback and the Admin bootstrap consume those factories.
2. Add a sanitized preview and an idempotent bootstrap command to the existing Admin content
   boundary. The command may run only when no published snapshot exists, the two starter locales are
   registered, code-owned page definitions match, and no existing content conflicts with the
   starter records.
3. The command writes through the existing versioned page/shared repositories. It creates only
   `ready` drafts, preserves existing site-integration identifiers, records the normal command
   receipts, and can resume after a partial write. It never publishes, changes locale registry
   state, creates a migration, or edits Provider/runtime configuration.
4. Admin presents the action as a first-run signal. Publication remains a separate `full`-mode
   command with the existing immutable snapshot validation and Web acknowledgement.

## Consequences

- The first production content seed is reviewable and reversible through existing draft, publish,
  retry, and rollback semantics.
- Repeated clicks cannot create duplicate content when the first run has completed; a partial run
  can be safely resumed with a new idempotency key.
- A content conflict or an already-published snapshot fails closed and requires ordinary editorial
  resolution. The action does not silently overwrite owner changes.
- No additional database table, public Web dependency, Provider request, or Admin permanent runtime
  is introduced.

## Rejected alternatives

- **Direct SQL seed job:** rejected because it would bypass command receipts, schema validation, and
  the owner review surface.
- **Auto-publish the bundled seed:** rejected because immutable publication must retain the existing
  explicit review, SEO, and Web acknowledgement gates.
- **Keep a second Web-only copy:** rejected because copy drift between fallback and first-run Admin
  content would be difficult to detect.
