# ADR-0057: Vidomon OK.ru portable-delivery rejection

## Status

Accepted for Work Item 120. Production activation was rejected.

## Context

Vidomon's anonymous browser protocol can be reproduced: a short-lived token is rendered by the
landing page, the client derives a deterministic request hash, and a same-origin REST request
returns metadata plus progressive OK CDN addresses. Current live verification from NL resolved six
MP4 entries for each of two native public samples.

Resolution did not produce portable delivery. The first two preferred CDN entries for each sample
returned HTTP 400 both with a one-kibibyte Range and with an ordinary GET. Vidomon's own download
link uses a fixed plugin path plus a media index and a session identifier. The API returned no
portable `sid`; supplying the anonymous PHP session identifier as `sid` without the Provider Cookie
returned HTTP 200 HTML, not media. The successful Provider-page flow therefore depends on the
Vidomon browser session.

## Decision

- Keep Vidomon as a resolution-only, `canary_failed` technical record. It is not registered in the
  production Worker, API health set, Admin route set, environment gates, or release scripts.
- Preserve the parser and synthetic fixture so an upstream change can be detected without
  rediscovering the token/hash protocol.
- Do not expose the session-bound plugin link, Provider page, PHP session, CDN URL, or request hash.
- Do not add a Vidomon rollout rule, public OK.ru page, sitemap entry, or production traffic.
- Do not solve the failure with a TikDD media proxy, Provider Cookie replay, browser automation, or
  a wider OK CDN rule.

## Consequences

Work Item 120 stops at the mandatory portable-delivery gate and does not launch OK.ru Beta. The
versioned host rule in the technical harness can validate candidate shape, but the production
router rejects Vidomon because its manifest has no delivery mode. OK.ru remains `planned`.

## Revisit condition

Re-test only after Vidomon returns a portable `sid` or a direct media address that succeeds from an
independent user exit without Provider cookies. Two distinct samples must pass browser delivery
before production wiring is added. A controlled media proxy would be a separate architecture and
abuse-cost decision, not a repair to this work item.
