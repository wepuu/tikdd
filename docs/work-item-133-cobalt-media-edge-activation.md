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

## Production activation

Before activation, the official backup script created and validated an encrypted PostgreSQL dump;
the release environment, Cobalt key registry and release manifest were also copied to a protected
rollback directory. The isolated qualification container and its temporary credentials were
removed before the production Cobalt service claimed its fixed localhost port.

The production key is limited to Cobalt service IDs `ok` and `tiktok`. Runtime configuration is:

- `ENABLE_COBALT_PROVIDER=true`;
- `COBALT_LICENSE_ACKNOWLEDGED=true`;
- `COBALT_DELIVERY_AUDIT_APPROVED=true`;
- `COBALT_APPROVED_PLATFORMS=odnoklassniki,tiktok`;
- `COBALT_DELIVERY_VERIFIED_PLATFORMS=`;
- `COBALT_DELIVERY_VERIFIED_CAPABILITIES=tiktok:tunnel`.

The first apply attempt correctly rolled back when the capability was not yet a subset of the
production approved-platform list. After adding only `tiktok` to that list, the official
`worker-config-apply` operation recreated the Worker and verified the runtime gates. A separate
one-shot Worker command then created the unique `cobalt-selfhosted-tiktok-nl` rollout rule at
revision 1, full allocation and no expiry. PostgreSQL, Redis, API, Worker, Delivery, Web and Cobalt
were healthy with zero restarts after activation; the public Web returned HTTP 200 and unsigned
Tunnel access returned HTTP 400.

## Manual verification and rollback

The owner performs the final TikTok browser download. A successful request may still be served by
SnapTik, TikCD or another higher-priority Provider; Cobalt is intentionally only a last-resort
sequential fallback. If Cobalt Tunnel delivery fails, first CAS-disable
`cobalt-selfhosted-tiktok-nl`, then clear `tiktok:tunnel`, close the three Cobalt gates, apply the
Worker configuration, and stop Cobalt if no other approved capability needs it.

Do not broaden the Cloudflare exception, expose the private Cobalt API, approve another platform or
mode, or add TikDD media-byte forwarding as part of this closeout.
