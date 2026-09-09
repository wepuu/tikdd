# Work Item 31 — Admin Beta preview closeout

Status: implemented locally on `codex/wi29-instagram-provider-replacement-feasibility`.
This is a small UI closeout for the private Admin Beta operations view; it does not change the
public resolver, Provider routing, rollout, gates, persistence schema, or production state.

## Delivered

- Moved `Beta 健康` into the existing `运行` navigation group so the owner path reads as one
  operational workflow instead of a detached product area.
- Localized the Beta health panel's operator copy, metric labels, empty states, and failure
  categories while keeping Provider names and platform identifiers unambiguous.
- Added defensive rendering for missing verification or failure codes from older aggregate data;
  an unexpected value is shown as a safe fallback instead of crashing the console.
- Kept the existing design tokens, typography, read-only data boundary, and responsive layout.

## Verification

The local Admin/API stack was started against the Docker-backed local PostgreSQL and Redis only.
The owner console was checked at desktop and 390px mobile widths, including the Beta 24-hour/7-day
window control. The stack was stopped after review; Admin remains stopped in production.

`pnpm check` passed: repository text checks, 21/22 workspace typechecks, 94 test files (527 tests),
and Web/Admin production builds. The existing untracked `apps/web/.next-web-qa/` directory was
preserved and is not part of this change.

## Release boundary

This commit is intentionally unpushed. Push, PR merge, and any on-demand production Admin
activation require separate owner approval. No Admin, calibration, or additional Provider process
was started as part of this work item.
