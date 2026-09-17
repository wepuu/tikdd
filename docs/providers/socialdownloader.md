# SocialDownloader.space Facebook Provider

Status: enabled as the Facebook Beta secondary route after Work Item 73 production audit

## Reviewed protocol

Work Item 71 observed an anonymous JSON request to the hosted service and a same-origin
`/api/video` media stream. Work Item 72 implements the protocol as a bounded Facebook-only
secondary Provider. The adapter accepts only the reviewed host and path, normalizes the response
through `@tikdd/contracts`, and never exposes the upstream media address in the public result.

The Provider is restricted to the NL region, has a 10-second request timeout, one request per
resolve job, no queue replay, and no user Cookie, login, browser state, CAPTCHA or challenge
bypass. Explicit private, deleted, unsupported and no-media responses are terminal; only bounded
upstream failures may fall through from FDown to this Provider.

## Delivery boundary

Delivery uses the existing one-use ticket and a reviewed `302` redirect. The allowed target is
`https://www.socialdownloader.space/api/video` only; TikDD does not read or proxy media bytes.
The current browser handoff remains `navigate`. Work Item 73 verified the one-use redirect and
Provider-owned stream without sending media bytes through NL, but did not establish a repeatable
CORS/browser-save contract. The browser may therefore open the approved media stream or player;
this is an accepted Beta fallback, not a Provider-page handoff. A separate reviewed change may
select the existing `cors-download` handoff only after a fresh protocol and browser-save audit.

## Activation boundary

All three settings must be true before the Worker can use the Provider:

```text
ENABLE_SOCIALDOWNLOADER_PROVIDER=true
SOCIALDOWNLOADER_TERMS_APPROVED=true
SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED=true
```

The rollout rule is separate from process gates and is created or updated by CAS. The production
Facebook order is FDown Isuru first and SocialDownloader second. The unique
`socialdownloader-space/facebook/nl` rule is enabled only for the audited secondary route; it does
not authorize X, TikTok, Instagram, or YouTube.

## Rollback

Restore the FDown-only route, CAS-disable the SocialDownloader rollout, then set the three gates
to `false` and run the release-env-bound `worker-config-apply` operation. Do not broaden the host
policy or retry boundary in response to a failed audit.
