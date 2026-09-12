# Work Item 42 — Admin workspace simplification

Status: implemented locally on `codex/stage8-admin-simplification` (release approval pending).

## Objective

Make the owner-only Admin console practical for daily operation without introducing a second
operations platform. The long single page is split into four focused workspaces:

- **概览** — today’s derived summary and alert queue.
- **内容** — structured page editing, SEO readiness and publication.
- **Providers** — capability coverage, Beta health, route inspection and guarded controls.
- **设置** — site identity, locales, Google integrations, recovery and account security.

Legacy section hashes remain accepted and map to the relevant workspace, so existing bookmarks and
alert links continue to work.

## Daily editing rule

This project has one operator. Routine content, locale, site identity and Google integration actions
therefore use the current deployment and locale confirmation internally. The UI no longer asks the
owner to type a reason, operator name, timestamp, revision or deployment ID for every edit. The Admin
API still receives its existing reason, expected revision, confirmation and idempotency values so
optimistic concurrency, CSRF and replay protection are unchanged.

Provider route, qualification and destructive recovery controls retain their explicit confirmations;
those operations can change traffic or recover a snapshot and are not routine editorial edits.

## Non-goals

- No database migration, public API, Provider adapter, rollout change or calibration activation.
- No permanent production Admin process; the Admin profile remains on-demand.
- No removal of backend audit/concurrency fields or safety checks.

## Acceptance

- Four workspace links render one workspace at a time, with keyboard focus states and responsive
  behavior at the existing desktop and mobile breakpoints.
- Legacy `#operational-truth`, `#publishing`, `#site-integrations` and related anchors select the
  expected workspace.
- Routine content/settings screens contain no reason or deployment-ID input; server contracts remain
  valid and existing Admin API tests pass.
- `pnpm check` (or its complete equivalent when the local command timeout is reached) passes lint,
  typecheck, tests and production builds.

## Next batch

Stage 9 reviews Provider manifests and routing as a single capability batch. SaveFromIns remains the
current Instagram Beta provider; new free candidates are isolated and bounded before any rollout
change.
