# Work Item 32 — Admin 按需生产启用准备

Status: complete after the owner-approved preview on 2026-09-10. Follow-up lifecycle fixes are
tracked by [Work Item 33](work-item-33-admin-lifecycle-gate-fix.md).

The public release portion of this work item was deployed before the Admin preview. The preview
started only the Admin profile, did not change Provider or rollout state, and stopped the Admin pair
after review. No calibration profile or additional Provider traffic was started.

## Baseline

| Item | Current value |
| --- | --- |
| Repository | `main@db94b0efe72c94b487421d188fd09038cca16a5a` (documentation merge; runtime release unchanged) |
| Web image | `ghcr.io/wepuu/tikdd-release-web@sha256:abcbe529afb453917bba7365d1c8c34ec5ae75df63a8441ea4d16e07e7cdef50` |
| Service image | `ghcr.io/wepuu/tikdd-release-service@sha256:97501a88599cf4147c5d72d644f3cfbfdc7c62c3fe74d77f99ca746e612b98ff` |
| Admin image | `ghcr.io/wepuu/tikdd-release-admin@sha256:4da7f14f51f0cad6a8ca9696d894b36ce4ed59c7ad969fd36540a7821d682629` |
| NL release | `3eedddb8e42ad2589490a081af9772cd975fc663` |
| NL core state | six core containers healthy; X/Instagram rollout state unchanged |
| Admin ingress | `admin.tikdd.cc` through Cloudflare Tunnel/Nginx; preview complete, Admin stopped |

The images were built by the GitHub `Release images` workflow for the merge SHA and deployed by
digest to the NL host. The previous `bdf6543a0e3c7fced09dc7b309616251d5f111f1` release remains the
rollback target.

The release backup is `/var/backups/tikdd/p0-dr-01/tikdd-prod-20260910T041023Z.dump.gpg` with
SHA-256 `8ac1fc3d08981513da491c020fe0bff0b9f5a76153fc07c830b19429f7159c00`. The release manifest
is `/opt/tikdd/releases/3eedddb8e42ad2589490a081af9772cd975fc663/release-manifest.json`.

Post-deploy proof recorded zero core-container restarts and zero observed API/Delivery 5xx during
the short watch. One X and one Instagram resolve → Delivery-ticket → client-direct media transfer
also completed successfully; a browser save-dialog was not automated.

## Owner preview proof (2026-09-10)

- `TIKDD_RELEASE_ENV=/etc/tikdd/production.env bash scripts/production-release.sh admin-start`
  pulled the pinned Admin and Service images and started `tikdd-admin-1` plus
  `tikdd-admin-api-1`; both reported healthy.
- Through the configured Cloudflare Tunnel and Nginx Host route,
  `https://admin.tikdd.cc/login` returned HTTP 200 with `cache-control: no-store`,
  `x-robots-tag: noindex, nofollow, noarchive`, CSP and `X-Frame-Options: DENY`.
- The owner authenticated as `solo` and confirmed the read-only Beta health view for the bounded
  windows. No route, Provider, content, rollout or calibration command was executed.
- Admin API remained private: host publication was `127.0.0.1:3301 -> 3001`; internal port 4100
  had no host listener.
- `TIKDD_RELEASE_ENV=/etc/tikdd/production.env bash scripts/production-release.sh admin-stop`
  stopped both Admin containers. The host gate emitted a transient load/health false positive;
  independent checks confirmed the pair exited, the public route returned 404, and all six core
  containers remained healthy. The gate contract issue is tracked in Work Item 33.

## Scope

1. Deploy the exact GitHub images for `main@3eedddb8` using the existing production release script.
   The deployment includes backup, idempotent migration verification, stage gates, health checks,
   and one X plus one Instagram browser download. It must not change Provider flags, rollout
   revisions, calibration, or other Provider state.
2. Prepare an owner-only `admin.tikdd.cc` route through the existing Tunnel/Nginx boundary. The
   route must be HTTPS and Host-specific, forward only to loopback Admin UI port `3301`, and never
   publish Admin API port `4100`. If DNS, Tunnel, or Nginx proof is missing, hold before starting
   Admin.
3. Start Admin on demand with the official `admin-start` operation, verify login/session security,
   inspect the read-only Beta health view for 24-hour and 7-day windows, observe resources and
   errors briefly, then run `admin-stop`.
4. Record the exact release, image digests, backup reference, access proof, Admin health result,
   and stop result. No content publication or route-policy mutation is part of the first session.

## Safety boundaries

- Admin remains a stopped production profile outside the approved owner session.
- Password authentication, CSRF, origin proof, `no-store`, and `noindex` remain mandatory.
- The Admin session is read-only for the first production preview; it cannot grant traffic or
  broaden Provider capability.
- X/Instagram rollout and gates are captured before deployment and compared afterward; any drift is
  a release failure.
- A failed public release rolls back to the previous `bdf6543a` release after the normal rule-first
  rollback checks. A failed Admin route removes/stops only the Admin path and does not roll back
  healthy public services.

## Acceptance

- Six core containers remain healthy with no material restart or 5xx regression.
- Public X and Instagram downloads still complete through the existing client-direct redirect
  path.
- `https://admin.tikdd.cc/login` is reachable only after the approved route and Admin profile are
  active; stopping Admin removes the live Admin process.
- Admin API is not reachable from the public network.
- Beta health data renders without URLs, task IDs, Provider payloads, CDN addresses, or credentials.
- Admin, calibration, and all unapproved Providers are stopped after the session.

## Out of scope

This work item does not promote X or Instagram to stable, publish GEO/landing content, add a new
Provider, start calibration, add a scheduler, or introduce a second identity or deployment system.
