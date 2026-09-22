# Work Item 88 — Admin growth truth and workspace refinement

Status: implemented locally from `main@e507e8a`.

## Objective

Make the single-owner Admin console accurately show whether Google integrations are live, separate
the download funnel into understandable stages, and improve readability without adding an audit or
workflow system.

## Changes

- Google Analytics and AdSense distinguish saved draft values from the active published snapshot.
  Saving remains a draft operation; publishing uses the existing immutable content command.
- Web loads code-owned Google tags from the published snapshot at the locale layout, emits the
  AdSense account metadata, and serves a bounded `/ads.txt` record when a publisher ID is live.
- Download reporting separates user tasks, Provider attempts, ticket creation, redirect validation,
  and browser handoff. A handoff is explicitly not claimed as a completed file save.
- Platform reporting is derived from runtime Provider manifests and catalog platform IDs instead of
  a four-platform UI list.
- Admin becomes five focused workspaces: overview, downloads and traffic, content, Providers, and
  settings. Type, density, mobile navigation, and signal hierarchy are tuned for one owner.

## Boundaries

No SQL migration, public resolve-contract change, arbitrary script injection, Provider rollout,
media proxy, calibration change, or new audit model is included. Google IDs remain bounded values,
not credentials. Existing publication, authentication, routing, and Delivery safety boundaries stay
authoritative.

## Verification

Targeted contract, persistence, Admin API, Admin UI, and Web tests cover published/draft truth,
dynamic platforms, funnel stage counts, tag rendering, and ads.txt output. The release gate remains
`pnpm check`, Compose validation, PR CI, immutable GitHub images, backup, and approved deployment.
