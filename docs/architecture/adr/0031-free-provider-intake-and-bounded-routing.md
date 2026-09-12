# ADR-0031: Free Provider intake and bounded access-friction routing

- Status: accepted for Work Item 44
- Date: 2026-09-12
- Scope: Provider qualification and route ordering

## Context

TikDD currently has one owner-approved Instagram download Provider (SaveFromIns) and two reviewed
X download Providers. The next expansion lane is limited to free, public-content Providers. A new
third-party URL must not become a manifest, Host policy, rollout rule, or production fallback merely
because a page happened to resolve once. SaveFromIns also reports occasional access friction, so a
future equivalent candidate should be preferred when the health window shows repeated rate limits or
interactive challenges.

## Decision

1. Keep candidate intake code-owned and offline. `@tikdd/providers` exposes a runtime-validated
   `FreeProviderCandidate` shape and a pure qualification function. Policy-incompatible candidates
   (paid API, login, cookies, interactive challenge, or non-public content) are rejected; missing
   review evidence is deferred. The function never writes persistence, changes a manifest, or grants
   rollout.
2. Require at least one success fixture and four negative/failure fixtures before a candidate can be
   classified as implementation-ready. Redirect candidates additionally require delivery evidence.
   Resolution-only candidates may be implementation-ready for technical work, but are never marked
   eligible for production download routing.
3. Extend the shared effective route score with a bounded access-friction penalty (0--80 points).
   The penalty is derived only from the sanitized routing-health snapshot and is neutral when data is
   missing. Manual order remains dominant, and a large platform-priority difference remains dominant.
4. Admin receives the same optional sanitized friction rate for explanation. No new public endpoint,
   migration, automatic Provider activation, or live third-party probe is added.

## Consequences

- A future free Provider can be screened consistently before adapter work without inventing a second
  Admin qualification engine.
- Equivalent Providers with recent access friction naturally move behind a healthy peer while the
  existing circuit breaker, sequential fallback, and attempt limits remain unchanged.
- WI44 does not add a Provider because no new owner-supplied candidate has passed the intake boundary.
  SaveFromIns, X routes, Admin, calibration, and rollout state remain unchanged.
