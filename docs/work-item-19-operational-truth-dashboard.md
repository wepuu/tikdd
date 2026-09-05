# Work Item 19 — Operational truth dashboard

Status: implemented and verified locally on 2026-09-05. Production deployment is pending.

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
