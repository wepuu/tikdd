# Work Item 48 — SnapTik Delivery browser handoff

Status: merged in PR #82 and deployed from `main@5008685f2f50528ac1861e5b95c14d549013d1c1`;
separate TikTok activation approval remains pending.

## Diagnosis

The failed TikTok activation created two Delivery tickets successfully, but neither ticket reached
the `/d/{ticket}` redemption endpoint. Both tickets later emitted `ticket_expiry=expired_unredeemed`.
There was no `redirect_validation` or `browser_handoff` outcome, so the reviewed media host and its
CDN response were never reached. The Delivery service, exact Host policy, and public DNS checks
remain unchanged and were not the failure boundary.

The Web flow previously required two interactions: create a ticket, then click a new cross-origin
link. The link used `target="_blank"` and was hidden immediately on click. This made a blocked or
missed browser navigation indistinguishable from a completed handoff while the ticket expired after
the existing 60-second TTL.

## Change

- The format action now creates the one-use ticket and immediately navigates the current browser
  tab to the opaque Delivery URL in the same user flow.
- The browser never receives or inspects the SnapTik CDN URL; Delivery still performs the exact
  Host/DNS validation and returns the reviewed 302 without transferring media bytes.
- Cross-origin `download` and new-tab behavior are no longer required for the primary delivery. A
  rendered fallback link retains the best-effort filename hint if navigation does not start; the
  final CDN response may still choose its own filename.
- Invalid navigation URLs fail closed in the Web helper; local HTTP remains available for development
  QA while production Delivery URLs remain HTTPS.
- SnapTik, Admin, calibration, and all unrelated Provider flags remain disabled. No migration or
  Provider request is part of this Work Item.

## Verification

- Added Web navigation helper tests for opaque HTTPS tickets, local development HTTP, malformed URLs,
  and non-web schemes.
- Added SnapTik to the Delivery redirect integration matrix, including one-use redemption and exact
  reviewed Host policy validation.
- Updated English and Chinese handoff copy to describe a direct browser download rather than a new
  tab.
- Local verification: 108 test files / 597 tests passed; Web and Delivery type checks passed.
- `pnpm check` passed locally and in PR CI. The production release used GitHub-built Web, Service,
  and Admin images, an encrypted PostgreSQL backup, idempotent migrations, and clean post-deploy
  health checks. Admin remains stopped.

## Release and rollback

1. Push this branch and open one PR. Merge only after CI and `pnpm check` pass.
2. Verify Web, Service, and Admin GHCR images were built from the exact merge SHA; Admin remains
   stopped.
3. With SnapTik disabled, back up PostgreSQL/configuration and deploy the GitHub-built images.
4. Obtain separate approval before enabling the existing SnapTik rollout. Perform one public TikTok
   test and verify, in order: ticket creation `201`, a `/d/` GET within a few seconds,
   `redirect_validation=passed`, `browser_handoff=redirect_issued`, and a non-zero browser media
   response from the reviewed CDN host.
5. If no `/d/` GET appears, continue with Web/browser diagnostics. If Delivery returns 502, review
   the exact Host/DNS policy without widening it automatically. If 302 succeeds but the CDN media
   request fails, keep SnapTik disabled and start the next free-Provider feasibility item.
6. On any activation failure, CAS-disable the SnapTik rollout first, then close its three gates;
   leave X and Instagram unchanged. Roll back the image only for a version-wide regression.
