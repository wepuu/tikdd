# ADR-0036: Multi-platform Provider routing isolation

## Status

Accepted for Work Item 75.

## Decision

Provider capabilities are routed by the exact tuple `providerId / platform / region`. A Provider
that supports several platforms does not receive one global production authorization. Each platform
declares its own manifest capability, priority, delivery modes, verification status, rollout rule,
circuit, and Admin health bucket.

SocialDownloader keeps one process-level terms/enablement boundary, but its upstream request budget
is shared across platforms because the hosted service can rate-limit the NL egress IP as one client.
The Worker applies a conservative fail-fast concurrency and interval budget and honors `Retry-After`
as a bounded provider-wide cooldown. It never queues extra work to make an upstream limit look
successful.

Only capabilities with a reviewed delivery mode can enter a production router in production. In
this release Facebook remains `delivery_verified` with the existing one-use redirect policy; X,
TikTok, Instagram, and YouTube are manifest-visible Lab capabilities with no production delivery
mode. Their future activation requires independent protocol, two-sample, and browser handoff
evidence plus a platform-specific policy.

Fallback remains sequential and bounded. Terminal content and authentication decisions stop the
route; retryable upstream failures may reach the next Provider for the same platform only. A
platform circuit never disables another platform, while the shared budget prevents concurrent
cross-platform pressure on the same upstream service.

## Consequences

- No database migration or public result field is required.
- Existing rollout and circuit persistence already use the exact tuple and remain authoritative.
- Admin can show one Provider with several capability rows without claiming all platforms are live.
- One platform's browser behavior cannot be reused as evidence for another platform.

## Rollback

Keep only the Facebook capability enabled and remove any platform-specific rollout rule whose
qualification fails. If the shared budget misbehaves, disable the SocialDownloader process gate and
restore the previous Facebook-only adapter image; existing Providers remain unchanged.
