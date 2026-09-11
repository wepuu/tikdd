# Stage 1 — Admin owner console and site integrations

Status: implemented and committed locally on `codex/stage1-admin-integrations` at `10ff503`;
pending PR/CI and separate production approval.

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

This stage is one integration branch and one PR. Targeted tests may run during development, but
there is no per-commit production deployment or repeated SaveFromIns testing. At the stage boundary
run the full check once, perform one Admin preview, and publish or roll back as a single unit.
