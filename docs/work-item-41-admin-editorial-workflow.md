# Work Item 41 — Admin Editorial Workflow

Status: implemented locally on `codex/stage7-admin-editorial-workflow`; external push, merge and production deployment remain separately authorized.

## Objective

Make the Admin content desk useful for routine, low-risk editorial maintenance after the first public
snapshot. An owner should be able to edit structured copy, inspect the template preview, save a draft,
mark it ready, or discard the draft without accidentally replacing fields that were not touched.

## Scope

- Edit the common title and summary plus every structured field in the homepage, platform, guide, FAQ and
  legal templates.
- Preserve all existing content fields, SEO path/indexability/sitemap/redirect settings and social
  metadata when an existing page is edited.
- Show a dirty/saved state, render the preview from current form values, and expose the existing bounded
  `page_discard` command for draft and ready revisions.
- Keep validation in `@tikdd/admin-contracts`; Safe Markdown remains the only accepted rich-text format.
- Add pure model coverage for lossless merging and SEO preservation.

## Non-goals and safety boundaries

- No database migration, new API surface, public diagnostic endpoint or new publication mechanism.
- No Provider, rollout, calibration, Admin production profile, Delivery or indexability policy change.
- No arbitrary HTML, remote URLs, JSON-LD or generic page schema. The editor remains constrained by the
  existing code-owned page definitions and contracts.

## Verification

Run the targeted editor-model tests and `pnpm --filter @tikdd/admin typecheck`, then the repository
`pnpm check` gate before opening the batched PR. Docker Compose validation remains an environment-level
release check and is not replaced by local mock state.

## Release handoff

After CI and merge, verify the exact GitHub-built image SHA. Production deployment requires a separate
approval, PostgreSQL/config backup, Admin read-only health check and one controlled editorial action.
If the edit is not ready, discard the draft; otherwise publish one immutable snapshot and observe the
existing propagation/rollback signals. Admin remains on-demand and is stopped after the operation.

