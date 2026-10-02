# Work Item 135: Cobalt TikTok production closeout

## Scope

Work Item 135 deploys the authenticated-readiness repair from Work Item 134, repeats the bounded
TikTok Tunnel qualification, runs one separately approved Cobalt-only owner browser window, and
conditionally retains Cobalt as the priority-450 TikTok secondary Provider. It does not approve a
new platform, Cobalt response mode, public API field or media-byte path.

## Release and configuration evidence

Production was upgraded to exact merge SHA `0c597b846f9fd3bc8874218fa864259266f88c76` using the
three immutable GitHub images. Before deployment, the official backup flow produced an encrypted
PostgreSQL dump and protected copies of the active environment, Cobalt registry and release
manifest. The active Cobalt registry uses the reviewed plural `userAgents` schema, is owned by
`root:tikdd-secrets` with mode `0640`, and grants only the `ok` and `tiktok` Cobalt service IDs.
This group-readable boundary is required because the pinned non-root container joins the dedicated
secrets group; group and other write bits remain forbidden.

The official `worker-config-apply` operation force-recreated Cobalt, passed the authenticated
invalid-link readiness probe and only then recreated Worker. The production configuration enables
the three Cobalt gates, approves `odnoklassniki,tiktok`, and verifies only `tiktok:tunnel`. The
legacy whole-platform verified list remains empty. API, Delivery, Worker, Web and Cobalt were
healthy with zero restarts after the change.

## Qualification and browser evidence

With rollout still closed, two public TikTok samples each returned one normalized Tunnel result.
Fresh descriptors passed bounded 1 KiB media checks from both the local direct exit and the local
v2rayN exit: HTTP 206, non-empty `video/*`, attachment disposition, reviewed CORS and private
no-store caching. Temporary source URLs, signed descriptors and probe files were deleted.

After separate approval, the unique Cobalt rule was CAS-enabled at revision 3 and full allocation.
SnapTik and TikCD were temporarily CAS-paused, leaving Cobalt as the only TikTok route. The owner
successfully resolved and downloaded the video in a real browser. The sanitized attempt ledger
then showed two successful `cobalt-selfhosted` attempts at 580 ms and 424 ms, proving the browser
result did not come from a primary Provider.

SnapTik and TikCD were restored immediately after the browser check, at revisions 10 and 8
respectively. Cobalt remains enabled at revision 3 and full authorization, but its manifest
priority keeps it behind those established Providers in bounded sequential fallback. The
SocialDownloader TikTok rule remains disabled at revision 2 and zero allocation.

## Known thumbnail limitation

The owner browser result had no preview thumbnail. This is an understood metadata limitation, not
a media-delivery failure: both persisted results had a null thumbnail, and the current Cobalt
adapter intentionally normalizes every response with `thumbnailUrl: null`. Cobalt Tunnel responses
provide the signed media descriptor and filename but no reviewed page thumbnail.

Thumbnail enrichment is deferred to a separate work item. It must use an explicit platform-owned
image source and host policy, remain optional, and never make an otherwise valid Cobalt resolution
fail. Work Item 135 does not add a second upstream request, expose the Tunnel descriptor, broaden
the media host policy or weaken the successful fallback path.

## Final state and rollback

- SnapTik and TikCD remain the primary TikTok routes at full authorization.
- Cobalt is an authenticated priority-450 TikTok Tunnel fallback at full authorization.
- Only `tiktok:tunnel` is production verified for Cobalt; other platforms and modes remain closed.
- TikDD Delivery continues to issue one-time plans and does not transfer Cobalt media bytes.
- The exact Cloudflare exception remains limited to `media.tikdd.cc`, `/tunnel`, and GET/HEAD.

If Cobalt authentication, resolution or browser delivery regresses, first CAS-disable
`cobalt-selfhosted / tiktok / nl`, then clear its verified capability and close the three gates via
`worker-config-apply`. Existing TikTok primaries stay enabled throughout that rollback.
