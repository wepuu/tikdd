# Work Item 26 — Instagram Beta reliability closure

Status: planned follow-up to PR #64; no production configuration change is included in this
record.

## Baseline

- Code checkpoint: `main@13a56f28fd03c9e9cf87966166b467cda6c47e5c`.
- PR #64 is deployed from GitHub-built immutable Web, Service, and Admin images.
- SaveFromIns/Instagram/NL remains owner-approved at full allocation. Admin, calibration, and all
  other Providers remain disabled.
- The adapter already handles sparse resource arrays and empty video quality (`Original`).
- The post-deploy smoke on 2026-09-08 produced one terminal `content_not_found` attempt for
  `DZxoImOOKr` and one `invalid_result` attempt for a previously successful Reel; it produced no
  new successful Instagram transfer.

## Bounded implementation

1. Reproduce one currently public Reel verified in a browser. Record only the sanitized response
   shape, normalized platform, and Provider attempt code. Do not retain media URLs, cookies,
   request markers, tracking parameters, or raw upstream bodies.
2. If the response contains a trusted direct MP4, add the exact redacted fixture plus adapter,
   routing, and Delivery-host regression coverage. Keep response-count, timeout, retry, SSRF,
   redirect, and host-suffix policies unchanged.
3. If no trusted direct MP4 is returned or the Provider is repeatedly challenged, stop adapter
   patching and open a separate Provider-replacement feasibility item. Do not add cookies,
   challenge bypasses, runtime host discovery, or new download modes.
4. Release through the existing MVP loop: targeted tests, `pnpm check`, PR CI, GitHub immutable
   images, encrypted production backup, manual deployment, one real Instagram transfer, and a
   15-minute health watch.

## Failure and rollback

If the real transfer or a core health gate fails, first CAS-update the exact
`savefromins / instagram / nl` rollout rule to `enabled=false` and `allocationBps=0`, then close
the three SaveFromIns gates. X remains unchanged. Roll back the application image only for a
version-wide failure, using the prior recorded release and backup.

## Exit criteria

- One current public Reel resolves to a direct MP4 under the existing allowlists.
- Delivery returns a non-zero video response and the browser flow completes.
- Core services remain healthy with no material 5xx or circuit-open event during the short watch.
- The release record contains the GitHub image digests, backup, sanitized attempt, and observation
  window without claiming stable Instagram support.

Until all criteria are met, Instagram remains experimental and noindex. This item does not start
Admin or calibration and does not activate another Provider.
