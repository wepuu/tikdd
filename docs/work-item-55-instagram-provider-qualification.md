# Work Item 55 — Instagram free-Provider qualification and routing boundary

Status: implemented as a bounded technical decision (2026-09-13).

## Objective

Reduce the Instagram single-provider risk without increasing SaveFromIns request frequency or
introducing a client-side Provider API. The first candidate is accepted only when its real protocol
is callable from the NL resolver with public input, no cookie, no login, no challenge bypass, and an
explicit Delivery host policy.

## Technical evidence

A single bounded NL inspection of `https://gramsnap.com/en/instagram-reels-downloader/` followed the
actual page flow and its referenced client bundle. The page exposes one GET form, but the client
resolves Reels through `POST /api/convert` with a `target_url` request body. The browser also adds
`x-token` from local storage and `wh-cf-token` from session state; the bundle loads Cloudflare
Turnstile support. These values are browser-held request state, not a stable server-side public
protocol that TikDD can call without forwarding client credentials or bypassing a challenge.

The landing transport returned HTTP 200 HTML and the bundle exposed the convert endpoint, so this is
not classified as a marketing-copy rejection. It is recorded as a technical access boundary:
`gramsnap` is `technicalState=blocked`, `evidenceState=not-evaluated`, and the offline portfolio
qualification remains deferred with `technical_blocked`. No Instagram Reel was submitted to
GramSnap from NL, no cookies or tokens were collected, and no response body or user URL was stored.

## Routing decision

SaveFromIns remains the only Instagram production Provider. Its existing bounded retry and fallback
classification are unchanged; there is no GramSnap rollout rule, process flag, Delivery allowlist,
database migration, or public API change. The existing Admin route detail and Beta health aggregate
are sufficient to observe provider attempts, fallback depth, delivery outcomes and circuit state.

Do not manufacture a GramSnap fallback by disabling SaveFromIns, and do not forward browser-held
tokens from users to the NL resolver. A future Instagram candidate must first provide a server-callable
public protocol and pass the normal fixture, Host/redirect, Delivery, CI, backup and deployment
loop. The next candidate can be evaluated after the current rate-limit window without repeatedly
probing SaveFromIns.

## Acceptance

1. Candidate protocol is classified from transport behavior rather than page marketing text.
2. Browser-held token requirements are recorded without persisting or forwarding the tokens.
3. `gramsnap` stays deferred and production-route ineligible; existing X, TikTok, Instagram and
   Admin runtime state is unchanged.
4. Temporary probe artifacts are removed locally and from the NL VPS.
