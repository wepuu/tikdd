# Work Item 133: Cobalt media-edge repair and TikTok secondary activation

## Scope

Work Item 133 repairs the Cloudflare edge boundary that blocked the second independent client exit
in Work Item 132, repeats the bounded TikTok Tunnel audit, and conditionally enables only
`cobalt-selfhosted / tiktok / nl`. Cobalt remains priority 450 behind the established TikTok
Providers. No other platform or Cobalt result mode is production-approved by this item.

## Edge and delivery evidence

The existing China deny rule was narrowed only for `media.tikdd.cc`, exact path `/tunnel`, and
methods `GET` or `HEAD`. A direct China request and a v2rayN request can now reach the media origin;
unrelated paths and `POST /tunnel` remain blocked. An unsigned Tunnel request returns the origin's
HTTP 400 response rather than the former Cloudflare 403, so the exception does not expose a usable
unsigned media endpoint.

Two reviewed public TikTok samples were resolved sequentially through an isolated, TikTok-only
Cobalt runtime. Both returned one normalized `tunnel` result. Fresh signed descriptors passed the
bounded 1 KiB audit from both independent user exits with HTTP 206, `video/*`, content ranges,
attachment disposition, exact Web-origin CORS and private/no-store caching. The audit did not log
source URLs, signed descriptors, response bodies, cookies or API keys. Automated browser control
was inconclusive, so final end-user download behavior remains an owner-operated browser check after
activation.

## Production activation attempt

Before activation, the official backup script created and validated an encrypted PostgreSQL dump;
the release environment, Cobalt key registry and release manifest were also copied to a protected
rollback directory. The isolated qualification container and its temporary credentials were
removed before the production Cobalt service claimed its fixed localhost port.

The intended production key was limited to Cobalt service IDs `ok` and `tiktok`. Runtime
configuration was:

- `ENABLE_COBALT_PROVIDER=true`;
- `COBALT_LICENSE_ACKNOWLEDGED=true`;
- `COBALT_DELIVERY_AUDIT_APPROVED=true`;
- `COBALT_APPROVED_PLATFORMS=odnoklassniki,tiktok`;
- `COBALT_DELIVERY_VERIFIED_PLATFORMS=`;
- `COBALT_DELIVERY_VERIFIED_CAPABILITIES=tiktok:tunnel`.

The first apply attempt correctly rolled back when the capability was not yet a subset of the
production approved-platform list. After adding only `tiktok` to that list, the official
`worker-config-apply` operation recreated the Worker and verified the Worker gates. A separate
one-shot Worker command then created the unique `cobalt-selfhosted-tiktok-nl` rollout rule at
revision 1, full allocation and no expiry. Container health, the public Web and unsigned Tunnel
checks passed, but these checks did not authenticate a Cobalt `POST /` request.

The owner-operated Cobalt-only browser window exposed that missing gate. Two tasks selected only
`cobalt-selfhosted` and both failed with sanitized Cobalt HTTP 400 diagnostics. An internal bounded
replay identified `error.api.auth.key.not_found`, and the Cobalt container log confirmed that the
key registry had failed to load because it used unsupported singular field `userAgent` instead of
the documented `userAgents` array. The apparent healthy runtime was therefore not authenticated.

The activation was rolled back immediately: SnapTik and TikCD were restored at full allocation,
and `cobalt-selfhosted-tiktok-nl` was CAS-disabled at revision 2 with allocation zero. Cobalt did
not become a production fallback. Work Item 134 owns the registry-schema validation, forced
container recreation and authenticated readiness repair.

## Manual verification and rollback

The browser verification failed before Cobalt produced media. Existing TikTok Providers remain the
only active production route. Any future Cobalt retry must first pass Work Item 134's authenticated
readiness check while the rollout remains disabled, then repeat the bounded two-sample
qualification and a separately approved Cobalt-only browser window. Rollback remains rule-first,
then capability and gate closure, followed by stopping Cobalt when no approved capability needs it.

Do not broaden the Cloudflare exception, expose the private Cobalt API, approve another platform or
mode, or add TikDD media-byte forwarding as part of this closeout.
