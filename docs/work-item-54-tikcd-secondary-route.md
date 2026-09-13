# Work Item 54 — Production convergence and TikCD secondary route

Status: implemented and deployed with TikCD disabled (2026-09-13).

## Baseline

`main@ae746768` contained Work Item 53. The merged Work Item 54 release is
`main@2e3745e8759f708d0afccb7c2a0e76f3ef9ae50f`; its CI and Release Images runs succeeded. The NL
VPS now runs that SHA from `/opt/tikdd/releases/2e3745e8759f708d0afccb7c2a0e76f3ef9ae50f` with
GitHub-built immutable Web/Admin/Service image digests. TikTok production traffic continues to use
SnapTik Monster; TikCD remains disabled by default.

## Objective

Converge production directly to one final Work Item 54 image, complete TikCD delivery qualification,
and make it a sequential fallback behind SnapTik Monster. No percentage traffic split is introduced.

## Scope

- Run one additional bounded NL protocol check against the recorded public TikTok sample set. Verify
  API status/schema, MP4 Range response, reviewed CDN suffix, and sanitized failure classification.
- Keep TikCD's exact `tikwm.com` API allowlist and reviewed `tiktokcdn-us.com` media suffix. Do not
  broaden the allowlist from page content or a marketing claim.
- Promote the code adapter to internal redirect candidates while retaining default-off activation
  gates. The public result remains URL-free and Delivery remains a one-use, short-lived 302.
- Configure route order `SnapTik Monster → TikCD`, omit TikCD from traffic-share allocations, and
  retain existing timeout, concurrency, circuit, and terminal-error boundaries.
- Deploy only GitHub-built images for the final merge SHA, after PostgreSQL/config backup. Admin stays
  running; X, Instagram, other Providers, and calibration state are unchanged.

## Acceptance

1. `pnpm check` and production Compose validation pass.
2. Two independent TikCD samples resolve normalized MP4 resources and pass Range checks.
3. A controlled browser flow reaches the reviewed TikTok CDN through Delivery 302; NL does not stream
   media bytes.
4. SnapTik success never calls TikCD; only an allowed SnapTik fallback failure reaches TikCD.
5. If the browser check or health signal fails, the TikCD rule and three gates are disabled first,
   leaving SnapTik as the sole TikTok route.

The single necessary approval in this stage is the explicit activation of TikCD's terms/delivery
gates and its rollout rule after the disabled-image health check. Routine code, CI, merge, backup,
and deployment steps do not require repeated approval.

## Deployment closeout

- CI and Release Images for PR #88 completed successfully. The deployed immutable digests are Web
  `sha256:be3a2bc0cffbca1e90e82ab69bed73cb5e3e558938536932dccf02440cbcafab`, Service/Worker/Delivery
  `sha256:eb941b9008eb48a06981327541d261dc5f29ed5ae161b78c6654b8c21f2dfbe0`, and the built Admin
  image `sha256:1d2cd38c7898fee81dcffa3e213036d1fc6c0d0f6d03a5ef6bf14a656f8f5610`.
- The pre-deploy production configuration backup is
  `/var/backups/tikdd/p0-dr-01/production.env.pre-wi54-2e3745e-20260913T060000Z`; the existing
  encrypted PostgreSQL artifact `/var/backups/tikdd/pre-migration-75f76b20.dump` passed the official
  backup verifier. The receipt is `/opt/tikdd/current/release-manifest.json`.
- The official staged deploy applied the idempotent migration set and passed baseline, image,
  datastore, migration, API, Delivery, Worker, Web and preflight gates. All eight running containers
  are healthy with zero restarts; API `/v1/platforms` returns 200 and Delivery invalid-ticket handling
  returns 410.
- `ENABLE_TIKCD_PROVIDER`, `TIKCD_TERMS_APPROVED` and `TIKCD_DELIVERY_AUDIT_APPROVED` are all
  `false`. No TikCD rollout rule or calibration container was started. Admin remains on and healthy;
  existing X, Instagram, SnapTik Monster and SaveFromIns gates are unchanged.
- The browser Delivery acceptance and creation of the unique TikCD secondary rollout rule remain the
  next owner-approved action. Until that approval, no TikCD Provider request is sent.
