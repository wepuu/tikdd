# Work Item 39 — First content publication and Admin commissioning

Status: planned operational phase after the Work Item 38 deployment at
`main@8f6eb9bb08196ece7ccb4601df2dd9a877c6bddf`.

## Objective

Use the existing owner Admin and publication center to turn the deployed bilingual starter
definitions into the first reviewed immutable public snapshot. This work item is intentionally a
single commissioning session with two separate production authorizations; it does not add another
content store or a new publishing path.

## Gate A — content-draft session

1. Capture the current release, configuration, provider/rollout state, and an encrypted PostgreSQL
   backup.
2. Set `ADMIN_WRITE_MODE=content-draft` and start Admin through the official on-demand release
   script. Keep the six core services and all Provider flags unchanged.
3. Log in as the owner, load the starter preview, and require an `eligible` response with no
   conflicts, no missing starter locales, and no existing published snapshot.
4. Apply the starter command once. Verify 14 page drafts and 2 shared-content drafts, all `ready`,
   with normal command receipts and no duplicate revisions on a repeat preview.
5. Review both locales, SEO fields, Beta/noindex rules, limitations, and optional Google integration
   identifiers. Unconfigured Analytics/AdSense values remain disabled; arbitrary scripts are never
   accepted.

The gate stops on any conflict or unexpected existing snapshot. It never overwrites owner edits.

## Gate B — full publication session

After the owner approves the reviewed content:

1. Obtain a separate `full` authorization and take a fresh encrypted PostgreSQL backup.
2. Run the existing publication preflight and require complete locale/content/SEO/settings readiness.
3. Publish one immutable snapshot and wait for Web acknowledgement/revalidation.
4. Verify the homepage, localized routes, canonical/robots/sitemap behavior, and that X/Instagram
   remain Beta/noindex and outside the sitemap.
5. Restore `ADMIN_WRITE_MODE=readonly`, stop Admin, and confirm `admin.tikdd.cc` returns 404.

If publication or acknowledgement fails, leave the prior Web fallback in place and use the existing
retry or snapshot recovery command. Do not create a second snapshot to mask a failed propagation.

## Completion criteria

- One active immutable snapshot is acknowledged by Web in both `en` and `zh-CN`.
- The published content matches the reviewed starter drafts; no draft is publicly rendered.
- Only explicitly configured and validated GA/AdSense identifiers render; otherwise integrations stay
  disabled.
- Six core containers remain healthy with zero restart storm, Admin is stopped, and Provider/rollout/
  calibration state is unchanged.
- The release record contains snapshot revision, command receipts, acknowledgement result, backup
  reference, and any content defects discovered for the next batched Admin improvement stage.

## Explicit non-goals

- No Provider smoke test or traffic change.
- No platform promotion, sitemap expansion, or indexability change for X/Instagram.
- No database migration, new API, arbitrary HTML/JavaScript, or permanent Admin process.
- No micro-release for each editorial correction; defects are collected for the next bounded batch.
