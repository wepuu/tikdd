# ADR-0046: 9xBuddy xHamster provider-hosted MP4 artifact

## Decision

9xBuddy may be used as the primary xHamster Provider after a second-sample browser audit. Its
current protocol is server-side conversion: the anonymous `/extract` response contains encrypted
format descriptors, and MP4 formats are prepared through `/download` and `/progress`. TikDD does
not fetch or relay the resulting bytes. Delivery only issues a one-time 302 to the final artifact.

The first production policy is exact-host `ab.9xbud.com` under
`9xbuddy-xhamster-artifact-v1`. No wildcard 9xBuddy, 9xPlayer, xHamster CDN, or arbitrary
redirect host is accepted. The final artifact must be anonymous and carry an attachment response;
Provider-page handoff is not a delivery mode.

The adapter derives the current x-auth-token from the landing page's bootstrap data on every
resolution, obtains a short-lived access token, submits the signed canonical URL, and prepares one
MP4 quality near 720p. It polls conversion progress for a bounded interval and cancels timed-out
jobs. Dailymotion remains Lab-only until its own two-sample Delivery audit.

## Routing and limits

9xBuddy has xHamster priority 700. LocoLoader remains priority 480 and is the sequential fallback.
The 9xBuddy adapter has no artificial daily quota, but uses one in-flight request and a two-second
minimum spacing by default. HTTP 429 and `Retry-After` are treated as fallback-eligible; queue
replay is disabled. Invalid/private/unsupported content is terminal and does not waste the
LocoLoader budget.

## Consequences

- xHamster resolution can take up to 90 seconds because the upstream may convert HLS to MP4.
- The public result never exposes the Provider URL, token, signature, or conversion descriptor.
- A 9xBuddy frontend release can change the token algorithm or response schema; such changes fail
  closed and route to LocoLoader until the adapter is updated.
- The policy is versioned so a future Provider artifact host or direct xHamster CDN can be audited
  independently.
