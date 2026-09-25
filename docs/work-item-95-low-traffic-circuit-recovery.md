# Work Item 95 — Low-traffic circuit recovery and six-platform operational closeout

## Baseline

The source baseline is `main@23b4b4aed39c19c2c63238e6512b5af07901c6bf`, which includes Work Item
94. Production remains on the previously deployed `main@1a3b285`; the WI94 images are built but
have not yet been deployed. SaveFromIns/Instagram/NL remains enabled at rollout revision 23, with
Admin available and calibration disabled.

## Problem and decision

Production traffic is intentionally small. The prior health policy required two successful
half-open observations, so a route could remain half-open after the first valid natural request.
The production policy is versioned to `production-low-traffic-v2` and requires one successful
half-open probe. The existing failure thresholds, cooldown bounds, single probe lease, sequential
fallback, and no-retry Provider boundaries remain unchanged.

Admin now distinguishes a half-open route waiting for its first natural recovery probe from one
that has already recorded recovery evidence. Cache hits, stale snapshots, and release checks are
not recovery evidence.

## Implementation

- Set `recoverySuccesses` to `1` in the versioned production environment example.
- Add ADR-0043 and a static release-contract verifier so the policy version and recovery boundary
  cannot drift silently.
- Add aggregation coverage for a one-success recovery policy while retaining the two-success
  behavior test as a generic policy contract.
- Keep the WI94 retained-payload metric correction and sanitized recovery count in the same release
  lineage; no migration or public contract change is introduced.

## Validation and release boundary

Run the targeted routing-health, Worker configuration, Admin read-model, and WI95 static tests,
then `pnpm check` and `git diff --check`. Docker Compose validation remains an environment check
because Docker Desktop is not available in the local CLI context.

Before production deployment, back up PostgreSQL, the active environment, and the release manifest;
apply the new environment revision through the official release path and verify the Worker sees
`production-low-traffic-v2` with `recoverySuccesses=1`. Do not change rollout allocation or Provider
gates, do not reset Redis, and do not issue a synthetic Provider request. The next distinct natural
request supplies the recovery evidence.

## Exit criteria

The release is complete when exact-SHA images are deployed, the eight core containers are healthy,
Admin metrics agree with retained PostgreSQL outcomes, and existing route/gate states are unchanged.
Instagram remains Beta; TikTok remains Stable; the other platform families retain their current
experimental/Beta status. No new Provider qualification or sitemap change is part of this item.
