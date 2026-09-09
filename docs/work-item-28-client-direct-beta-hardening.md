# Work Item 28 — Client-direct downloads and bounded Instagram recovery

Status: implementation on `codex/wi28-client-direct-beta-hardening`; no production change in this
work item yet.

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
