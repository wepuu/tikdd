# Work Item 132: Cobalt TikTok secondary activation

## Scope

Work Item 132 attempts the first production activation of a topology-qualified Cobalt capability.
Only `tiktok:tunnel` is in scope. Cobalt must remain behind SnapTik, TikCD and SocialDownloader at
manifest priority 450, and no other platform or Cobalt response mode may be enabled by this item.

The activation is fail-closed. Two current TikTok samples must resolve through the reviewed Tunnel
policy, two independent client exits must pass the bounded media audit, and the standard one-time
TikDD Delivery handoff plus a real browser save must succeed before the Provider gates, key scope,
capability or rollout rule can be changed.

## Release

`main@5fdcc546ed70870720e6f5d97428af88cef73f72` was built by GitHub and deployed with Cobalt closed.
The deployed Service and Web images are pinned to the exact merge SHA and recorded digest. The
release used an encrypted PostgreSQL backup plus release-environment and manifest backups. Web,
API, Worker and Delivery were recreated with zero restarts and healthy status; the already-running
Admin services were not restarted.

The deployed environment retained:

- `ENABLE_COBALT_PROVIDER=false`;
- `COBALT_LICENSE_ACKNOWLEDGED=false`;
- `COBALT_DELIVERY_AUDIT_APPROVED=false`;
- empty `COBALT_DELIVERY_VERIFIED_PLATFORMS` and
  `COBALT_DELIVERY_VERIFIED_CAPABILITIES`.

## Closed-gate result

An isolated UUID key allowed only the Cobalt `tiktok` service. The production Worker never received
the key and never registered Cobalt. Two approved samples were executed sequentially through the
closed-gate qualification runner. Both returned HTTP 200 `tunnel` responses with one normalized
video candidate using `cobalt-selfhosted-tunnel-media-v1`.

Fresh descriptors were then checked with a one-kibibyte Range request:

- the local v2rayN client exit passed both samples with HTTP 206, `video/*`, non-zero bytes,
  attachment disposition, exact Web-origin CORS and private/no-store caching;
- the local direct exit returned a Cloudflare HTTP 403 for both descriptors before reaching the
  query-free Nginx media access log;
- a separate unsigned `/tunnel` request produced the same Cloudflare blocked page on the direct
  exit, while the proxied exit reached the origin. This isolates the failure to the Cloudflare edge
  path rather than Cobalt parsing, signing or Nginx route validation.

The second independent client-exit requirement therefore failed. The one-time Delivery handoff and
real browser save were not eligible to run, and no production activation was attempted.

## Closeout

The original OK-only Cobalt key registry was restored, the isolated Cobalt container was stopped,
and all source inputs, signed descriptors and local temporary files were deleted. Cobalt gates and
capabilities remain closed. No `cobalt-selfhosted / tiktok / nl` rollout rule was created or
enabled, and all existing TikTok Providers and traffic remain unchanged.

The next work item must inspect Cloudflare security behavior for `media.tikdd.cc` using a real
browser and narrowly scoped rule evidence. It must not make the Cobalt API public, expose another
path, bypass Cloudflare, weaken unrelated host protections or grant Cobalt traffic before the two
client exits, one-time handoff and browser save all pass.
