# ADR-0035: SocialDownloader Facebook secondary routing

## Status

Accepted for Work Item 72 implementation; production activation remains separately gated.

## Decision

TikDD may call the anonymous `socialdownloader-space` API as a bounded Facebook secondary
Provider. The adapter sends one JSON `POST` to `/api/download` and accepts only the observed
same-origin `/api/video` stream on `www.socialdownloader.space`. The Delivery policy therefore
checks both the exact host and the reviewed `/api/video` path prefix. It issues the existing
one-use redirect ticket; TikDD never reads or streams media bytes.

The router keeps FDown Isuru as the higher-priority primary and reaches SocialDownloader only
after a retryable primary failure. SocialDownloader has one request per resolve job and is not
replayed by the queue. Explicit 422/no-media, private, unavailable, schema, and challenge
responses are terminal for that route; transient upstream failures remain eligible for the
router's bounded sequential fallback.

Only Facebook is registered in this release because Work Item 71 has two repeatable samples for
that platform. X and TikTok remain Lab-only until each has a second sample and a browser delivery
audit. Instagram and YouTube are not added to this route.

## Safety and rollback

The provider is disabled by default and requires both `SOCIALDOWNLOADER_TERMS_APPROVED` and
`SOCIALDOWNLOADER_DELIVERY_AUDIT_APPROVED` before process-level activation. No rollout rule,
public result field, Provider page handoff, user cookie, or new media proxy is introduced. A
future production rollout must first verify the provider stream's redirects, MIME, Range,
Content-Disposition/CORS behavior, expiry, and browser save behavior; disabling the gate and
rollout rule is the rollback.
