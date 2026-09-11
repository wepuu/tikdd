# Stage 1 — Admin owner console and site integrations

Status: implemented, merged through PR #73, and deployed in the current production lineage
(`main@96a4ad6`). The implementation was originally developed on `codex/stage1-admin-integrations`;
the deployment used GitHub-built immutable images. The integration values remain disabled until an
owner enters valid IDs and publishes a content snapshot through Admin.

This stage groups the first Admin productization work into one review and release. It adds a
bounded Google Analytics / Google AdSense configuration surface to Admin settings while keeping
the existing draft → preview → immutable publication flow.

## Scope

- Accept only `G-...` Analytics measurement IDs and `ca-pub-...` AdSense publisher IDs.
- Save them as the default Locale's shared-content draft; do not accept arbitrary HTML or
  JavaScript.
- Copy the validated values into the published snapshot as a site-level integration object.
- Render fixed Google tags in Web only after the snapshot is published.
- Keep `readonly` safe, allow saving in `content-draft`, and require `full` for publication.
- Keep Admin on demand, all Provider rollout and calibration state unchanged, and preserve the
  current client-direct Delivery path.

## Stage exit criteria

- Contract, Admin API, persistence compatibility, Admin UI, Web rendering, and security tests pass
  together in one `pnpm check` run.
- A local Admin session can save, refresh, and preview both IDs; invalid values are rejected.
- A published snapshot contains only validated identifiers and old snapshots parse with both
  integrations disabled.
- A Web page emits the fixed Google tags only when the corresponding published ID is present.
- PR CI passes; production uses the GitHub-built image after one backup and one approved deployment.
- No Provider request, rollout change, Admin permanent profile, or database migration is added.

## Release cadence

This stage was one integration branch and one PR. Targeted tests ran during development, followed by
one full check, GitHub image build, encrypted production backup, and manual deployment. There was no
per-commit production deployment or repeated SaveFromIns testing. Future Admin/content changes are
grouped into Stage 2 instead of reopening this stage.
