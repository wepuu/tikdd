# Work Item 139: Dailymotion production qualification closeout

## Release

PR 165 merged Work Items 137 and 138 at exact SHA
`47f9a8d7eab324b51f1e51d7c1fcfdec6512ff9a`. GitHub Actions produced immutable Web, Service and
Admin images. Before deployment, PostgreSQL was exported as an encrypted custom-format archive,
copied off host and verified by SHA-256. The official release command completed its idempotent
migration, authenticated Cobalt readiness and every shared-host stage gate. Web, API, Delivery and
Worker use the exact merge-SHA images; Admin stayed healthy and calibration stayed stopped.

Old TikDD application images that were neither active nor referenced by the current or previous
approved rollback manifests were removed after the disk gate detected low free space. No volume,
database image, Cobalt image or unrelated shared-host resource was removed.

## Production qualification

The production Cobalt key was temporarily expanded from `ok,tiktok` to
`ok,tiktok,dailymotion`. Dailymotion remained absent from both Worker approved platforms and
verified capabilities, so no user task could select it. Authenticated readiness passed before the
bounded qualification.

Both reviewed public samples resolved successfully and independently:

- response mode: `tunnel`;
- HTTP status: 200;
- one normalized video format and one delivery candidate per sample;
- exact Host Policy: `cobalt-selfhosted-tunnel-media-v1`;
- resolver duration below one second per sample.

The signed descriptors were transferred only through the UID-1000, mode-0600 artifact introduced
by WI138. A direct client exit then requested at most 1 KiB from each descriptor. Both requests
reached the exact Cloudflare/Tunnel boundary and returned attachment, exact-origin CORS and
private/no-store semantics, but HTTP 416 with zero media bytes. Because the first required exit
failed, the second exit, one-time Delivery handoff and full browser save were not used as evidence.
No descriptor, source URL, response body, credential or complete media URL is retained here.

## Fail-closed result

Dailymotion remains `delivery-blocked` with `range_unverified`, `cross_exit_unverified`,
`delivery_handoff_unverified` and `browser_save_unverified`. No rollout rule was created and no
public page, sitemap entry or SEO status changed.

The pre-window key registry was restored to `ok,tiktok`, every temporary descriptor and input was
deleted, Cobalt authenticated readiness passed, and Worker was force-recreated with only
`odnoklassniki,tiktok` and `tiktok:tunnel`. The brief recovery failure was caused by restoring the
backup copy with mode 0600 instead of the required root/secret-reader 0640; correcting only that
file mode restored Cobalt without changing its contents or routing.

## Next boundary

A follow-up must diagnose why Cobalt's Dailymotion Tunnel rejects a bounded byte range. It may
compare HEAD, an initial GET without Range that is cancelled after 1 KiB, and Cobalt upstream
metadata in an isolated environment, but it must not download full media, expose signed URLs,
weaken the Tunnel Host Policy or enable Dailymotion user traffic. Production activation remains
blocked until two samples pass both independent client exits, one-time Delivery and an owner
browser save.
