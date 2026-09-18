# SocialDownloader.space multi-platform Provider

Status: Facebook is enabled as a Beta secondary route. X has passed the owner-observed client
browser handoff audit in Work Item 77 and is eligible for secondary activation; TikTok remains
pending its isolated browser audit.

SocialDownloader is one Provider with platform-specific capabilities. Rollout, circuit, delivery
policy, and qualification are evaluated per `socialdownloader-space/<platform>/nl`; enabling the
Provider process does not authorize every declared platform.

## Reviewed protocol

Work Item 71 observed an anonymous JSON request to the hosted service and a same-origin
`/api/video` media stream. Work Item 72 implements the protocol as a bounded Facebook-only
secondary Provider. The adapter accepts only the reviewed host and path, normalizes the response
through `@tikdd/contracts`, and never exposes the upstream media address in the public result.

The Provider is restricted to the NL region, has a 10-second request timeout, one request per
resolve job, no queue replay, and no user Cookie, login, browser state, CAPTCHA or challenge
bypass. A shared fail-fast budget covers all platform requests and honors `Retry-After`; explicit
private, deleted, unsupported and no-media responses are terminal.

Current capability state:

- Facebook: `delivery_verified`, active secondary after FDown.
- X: repeatable protocol evidence and a successful owner-observed client-browser handoff; activate
  only through the platform-specific rollout rule and runtime lists.
- TikTok: repeatable protocol evidence and a versioned Delivery policy; production activation remains
  blocked until the one isolated browser handoff audit is complete.
- Instagram and YouTube: Lab-only failed or deferred evidence; no production delivery mode.

## Delivery boundary

Delivery uses the existing one-use ticket and a reviewed `302` redirect. The allowed target is
`https://www.socialdownloader.space/api/video` only; TikDD does not read or proxy media bytes.
The current browser handoff remains `navigate`. Work Item 73 verified the one-use redirect and
Provider-owned stream without sending media bytes through NL, but did not establish a repeatable
CORS/browser-save contract. The browser may therefore open the approved media stream or player;
this is an accepted Beta fallback, not a Provider-page handoff. A separate reviewed change may
select the existing `cors-download` handoff only after a fresh protocol and browser-save audit.

Platform activation is split into two explicit runtime lists:

```text
SOCIALDOWNLOADER_APPROVED_PLATFORMS=facebook
SOCIALDOWNLOADER_DELIVERY_VERIFIED_PLATFORMS=facebook
```

The second list must be a subset of the first. A platform absent from either list cannot enter the
production router. This allows X or TikTok to be rolled back independently while Facebook keeps
its existing secondary route and Provider-wide gates remain enabled.

## Activation boundary

All three settings must be true before the Worker can use the Provider:

```text
ENABLE_SOCIALDOWNLOADER_PROVIDER=true
SOCIALDOWNLOADER_TERMS_APPROVED=true
SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED=true
```

The rollout rule is separate from process gates and is created or updated by CAS. The production
Facebook order is FDown Isuru first and SocialDownloader second. When separately audited and
authorized, X appends SocialDownloader after the existing X route, while TikTok appends it after
SnapTik Monster and TikCD. The unique rollout rule is always platform-specific; the Facebook rule
does not authorize X, TikTok, Instagram, or YouTube.

## Rollback

Restore the FDown-only route, CAS-disable the SocialDownloader rollout, then set the three gates
to `false` and run the release-env-bound `worker-config-apply` operation. Do not broaden the host
policy or retry boundary in response to a failed audit.
