# ADR-0045: LocoLoader shared extraction budget and platform-scoped routing

## Decision

LocoLoader is treated as one upstream Provider whose anonymous extraction quota is shared by the
NL Worker fleet. The first production capability remains xHamster only. X, TikTok, and Facebook
are manifest-visible Lab capabilities and cannot produce a Delivery candidate until a platform-
specific CDN policy and two-sample delivery evidence exist.

The Worker reserves an extraction token in Redis before the LocoLoader `api-extract` POST. The
default budget is two extraction POSTs per six-hour window, one in-flight request, and a one-second
minimum interval. These values are configuration, not routing logic. Releasing a request clears
only the in-flight lease; it never returns a consumed extraction token. Queue retries are disabled
for LocoLoader, and a locally exhausted budget returns a typed, fallback-eligible rate-limit error
without calling the upstream.

## Rationale

LocoLoader's free limit is applied to the shared NL-side session/IP, not independently to each
TikDD user. A per-user counter would therefore give a false sense of capacity and could exhaust the
upstream window through concurrent workers. The Redis reservation is atomic and removes expired
in-flight leases so a crashed Worker cannot permanently block the route.

Platform capabilities remain separate in the Provider manifest. Existing X, TikTok, and Facebook
Providers remain primary; LocoLoader is not silently added as a broad fallback. xHamster keeps its
reviewed `*.xhcdn.com` Delivery policy and the existing one-use redirect path.

## Consequences

- LocoLoader production traffic is deliberately low volume and xHamster-scoped.
- Adding a second platform requires real protocol fixtures, a dedicated host policy, and browser
  Delivery verification; changing the approved-platform list alone cannot grant production access.
- The public result contains no LocoLoader URL, cookie, form key, quota identity, or Redis key.
- SaveTheVideo remains a deferred candidate until NL-side requests complete two samples without
  relying on Provider-page handoff or browser state.
