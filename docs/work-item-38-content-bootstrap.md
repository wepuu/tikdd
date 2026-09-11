# Work Item 38 — First bilingual content snapshot bootstrap

Status: implementation on `codex/work-item-38-content-bootstrap`.

## Objective

Close the gap between the reviewed Web seed and the empty production content tables. The owner can
preview and create the first bilingual structured content set from Admin, then review each page and
publish one immutable snapshot through the existing publication center.

## Delivered in this work item

- `@tikdd/admin-contracts` owns the bilingual starter records for homepage, FAQ, help, privacy,
  terms, X Beta, and Instagram Beta.
- Web's bundled last-known-good snapshot and the Admin bootstrap use the same content factories.
- `GET /admin/v1/content/starter` returns a sanitized readiness preview. It reports counts, missing
  starter locales, and bounded conflict targets only.
- `POST /admin/v1/content/starter/apply` is available in `content-draft` or `full` mode. It is
  idempotent and resumable: it creates only `ready` page/shared drafts, preserves existing Google
  integration identifiers, and refuses to run after any published snapshot exists or when content
  conflicts are detected.
- Admin's first-run signal card clearly states that initialization does not publish. The existing
  `full` publication command and Web acknowledgement remain the only way to advance a snapshot.
- No SQL migration, new Provider, rollout change, calibration profile, permanent Admin process,
  raw HTML, arbitrary script, submitted URL, upstream URL, or media field was added.

## Verification

- Starter schema tests cover all 14 page records, two shared blocks, SEO/noindex rules, safe
  integrations, and Admin command parsing.
- Service tests cover empty preview, ready-draft creation, and a repeat invocation that creates no
  duplicate revisions.
- Existing Admin API boundary, Admin client, and Web published-content tests remain green.
- Run the repository `pnpm check` gate before opening the PR.

## Production handoff (separate authorization)

After merge and GitHub image verification, use the existing on-demand Admin session with Admin
containers stopped outside the session:

1. Back up PostgreSQL and deploy the GitHub-built Web/Service/Admin images without changing Provider,
   rollout, or calibration state.
2. Start the approved Admin preview session in `content-draft` mode, inspect the starter preview,
   create ready drafts, and review the bilingual pages.
3. Obtain a separate approval for `full`, publish the immutable snapshot, verify Web acknowledgement,
   and stop Admin again. If publication fails, leave the prior Web fallback in place and use the
   existing retry or rollback command.
