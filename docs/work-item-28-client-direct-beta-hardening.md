# Work Item 28 — Client-direct downloads and bounded Instagram recovery

Status: complete and deployed from `main@bdf6543a0e3c7fced09dc7b309616251d5f111f1` on
2026-09-09. The release preserved the redirect-only Delivery path and did not start Admin,
calibration, or any additional Provider.

## Decision

TikDD continues to issue a short-lived, one-use Delivery ticket that returns a reviewed `302` to
the Provider media host. The browser, not the NL VPS, downloads the media bytes. This keeps the
user's IP as the CDN source for media transfer and avoids making the Delivery service a proxy.

The Web UI supplies a best-effort `download` filename hint using
`TikDD-{Platform}-{ContentId}-{Quality}.{extension}`. Cross-origin redirects and CDN response
headers may override that hint; retaining the CDN filename is an accepted compatibility outcome.
TikDD does not fetch media into a Blob, expose the upstream URL, or promise a universal filename.

## Instagram retry boundary

SaveFromIns remains an NL-only, redirect-capable Instagram Beta Provider. Each Instagram task has
at most two BullMQ attempts (the initial run plus one retry). The retry is reserved for
`provider_unavailable` and `provider_timeout`, covering network failures, HTTP 5xx, and HTTP 408.
403, 429, challenges, authentication failures, private/not-found content, schema changes, and
invalid results do not trigger an automatic second request; the user may submit again manually.
X retains its existing three-attempt behavior. The existing health circuit and cooldown policy are
unchanged so repeated Provider failures continue to protect the NL source IP.

## Diagnostics

The Worker emits an internal `savefromins_resolution_diagnostic` summary with task ID, phase,
outcome, HTTP status, coarse content-type category, resource count, valid direct-MP4 count,
failure code, and duration. It never emits the submitted URL, response body, title, auth value,
Cookie, request headers, or CDN URL. No migration, public endpoint, or always-on diagnostic store
is introduced.

## Release and rollback

1. Run focused Web, Provider, Worker, and Delivery tests plus `pnpm check`.
2. Open PR and wait for CI; after merge verify GitHub-built immutable image digests.
3. With separate deployment authorization, back up PostgreSQL and deploy without changing X or
   Instagram rollout/gate state. Admin, calibration, and other Providers stay stopped.
4. Perform one X and two distinct public Instagram browser downloads. Verify the Delivery request
   is a small redirect and the final media request is made by the browser to the reviewed CDN.
5. Observe core health, 5xx, Provider failure classes, and circuit state for 15 minutes.
6. If Instagram shows repeated rate-limit/challenge failures or the circuit opens, disable its
   rollout rule first and then its three gates; X remains unchanged. Roll back the image only for a
   version-wide failure.

After ten distinct Instagram tasks, retain SaveFromIns as the Beta Provider only if end-user task
success is at least 70% and no access-friction pattern is emerging. Otherwise open the next
Provider-replacement feasibility item; once an alternate Provider qualifies, SaveFromIns may be
demoted to a low-share fallback.

## Production closeout

The GitHub-built release used the exact immutable image digests below:

- Service/Worker/Delivery: `sha256:d52df4147f9711736b06643bec762157265744dc6686b3249186ad8f99cc1206`
- Web: `sha256:a3e4be45e712ab09f47faaa64d0eab3535644268bbdca23a3cbdb60970ac8a43`
- Admin image was built and recorded but the Admin profile remained stopped:
  `sha256:ef828d7bb4c3be58e04ba3d25f75f29cd5f3283d6827f6264067832bb27d0900`

Before deployment, PostgreSQL was backed up to the encrypted artifact
`/var/backups/tikdd/p0-dr-01/tikdd-prod-20260909T120940Z.dump.gpg` (SHA-256
`c099106c2da84fff0ce3cdeddaa2a1736d16b19e7452796dbb7fe42a972fa4c3`). The active release directory
is `/opt/tikdd/releases/bdf6543a0e3c7fced09dc7b309616251d5f111f1`.

The browser smoke completed one public X download (26,119,225 bytes) and one public Instagram
download (4,476,966 bytes). Delivery returned the reviewed redirect and the browser fetched the
non-zero media body directly from the Provider CDN. The CDN chose its own filename instead of the
best-effort browser hint; this is an accepted cross-origin compatibility outcome.

The 15-minute observation recorded 15/15 healthy samples for all six core containers, zero
restarts, and HTTP 200 readiness for API and Delivery. The rollout and gate state was unchanged:
X and Instagram remained enabled, while Admin, calibration, and all other Providers stayed off.

The first seven-day anonymous Beta report after this release is recorded in
[Work Item 29](work-item-29-instagram-provider-replacement-feasibility.md). It is below the
Instagram retention threshold, so a bounded Provider decision is now the next work item.
