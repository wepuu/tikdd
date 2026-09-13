# Work Item 54 — Production convergence and TikCD secondary route

Status: planned implementation stage (2026-09-13).

## Baseline

`main@ae746768` contains Work Item 53 and has successful CI and Release Images runs. The NL VPS is
healthy but still runs the older `9c0a259` release. TikTok production traffic currently uses SnapTik
Monster; TikCD is disabled by default.

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
