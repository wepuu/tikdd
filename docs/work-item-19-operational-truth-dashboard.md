# Work Item 19 — Operational truth dashboard

Status: implemented, verified, and deployed to the NL production host on 2026-09-05. Admin remains
stopped and all public Provider rollout remains disabled.

## Outcome

The Owner Console has one read-only support ladder for each platform in the concrete Admin region.
It separates catalog recognition, Provider resolution capability, controlled Delivery verification,
exact-route Canary evidence, current runtime availability, platform lifecycle, and derived SEO
eligibility. A planned or recognized platform is never presented as currently downloadable.

`GET /admin/v1/operational-truth` is the authoritative browser-safe projection. It composes existing
Manifest, platform catalog, rollout, restrictive guard, circuit, Canary, editorial, and Work Item 17
operational-service projections. It creates no persistence, qualification, rollout, publication, or
Provider request side effect.

## Explainability contract

- Every platform contains exactly seven ordered ladder steps with `pass`, `warning`, `block`, or
  `unavailable` state.
- Provider rows remain exact `(provider, platform, region)` tuples and expose only allowlisted
  capability, Canary, allocation, guard, circuit, and runtime states.
- Stable reason codes distinguish region mismatch, disabled Provider, missing Delivery mode,
  unverified Delivery, missing/failed/stale Canary, missing rollout grant, restrictive guard, open
  or stale circuit, insufficient runtime evidence, unpublished presentation, incomplete content,
  and derived SEO ineligibility.
- Missing or failed sources remain degraded/unavailable. They are not converted to zero or healthy.
- Canary evidence is region-exact. A `canary-global` measurement cannot satisfy an `nl` production
  route.
- WI17 scheduler freshness is read from `operational_service_status` for Canary, evidence, and
  cleanup; raw systemd output is not exposed to the browser.

## Safety boundaries

- The endpoint uses the existing authenticated, same-origin, loopback Admin API boundary and the
  existing BFF fixed-path client.
- Schemas are strict and pass through `assertAdminSafeValue`; submitted URLs, task/media IDs,
  candidates, headers, credentials, Provider payloads, and arbitrary upstream errors are excluded.
- Provider capabilities and regions remain code-owned. The projection does not infer arbitrary
  platforms or hosts.
- The dashboard is observational only. It cannot enable Admin, a Provider, calibration, rollout,
  public traffic, platform publication, or indexing.

## Verification

- Contract tests require all seven unique ladder stages and reject unknown/forbidden fields.
- Admin API composition tests prove that a disabled Provider remains unavailable even when catalog,
  Delivery, and fresh Canary evidence pass independently.
- BFF tests prove the new read uses a fixed authenticated Admin path and preserves partial-source
  failure behavior.
- `pnpm test:work-item-19` is the focused gate; `pnpm check` is the repository handoff gate.

## Production deployment

PR #43 passed CI and merged as `3375e5c5be931ccbe04d7a348887cd89d48237b9`. The NL release uses
the following immutable images:

- Web: `ghcr.io/wepuu/tikdd-web@sha256:b3cac9f43c06eb576a8581a94a7293666fda5a1abcf151c7199058b97a2cb94f`;
- Admin: `ghcr.io/wepuu/tikdd-admin@sha256:1fd9d2913c81beb0d9e5e2863a980d3faff751583b9663d32a2a46f7096485db`;
- Service: `ghcr.io/wepuu/tikdd-service@sha256:ab1dc68b214d0067e54a38d1561f47145a659376c1aacf82b7317196e6aec8f4`.

The release script passed backup verification, idempotent migration, every shared-host stage gate,
and the required rollout-disabled Provider preflight (`blocked`, exit 2). API, Delivery, Worker, and
Web reported healthy with zero restarts on the new images. Web and API returned 200, an invalid
Delivery ticket returned 410, and the unpublished Admin origin returned 404.

The first post-deployment operational-readiness invocation fell on a WI17 execution boundary: the
Canary row was late but inside its grace window (`degraded`), while evidence and cleanup were
actively running with acquired leases. The verifier correctly returned non-ready after the
application deployment had completed. No rollback was required: the next authoritative projection
showed all three services `completed`, `fresh`, lease released, zero consecutive failures, and
ready; the full shared-host gate then passed again. This is recorded as a transient post-check race,
not hidden as an application deployment success signal.

Admin containers/listeners were absent. Worker runtime flags for TwitterSaver, SSSTwitter, DLPanda,
general Canary, and public rollout remained false. The only active rollout rule remained the
pre-existing WI17 `ssstwitter/x/canary-global` scheduled authorization, and the deployment window
created zero `provider_attempts`. No calibration, pilot, platform promotion, or indexing began.
