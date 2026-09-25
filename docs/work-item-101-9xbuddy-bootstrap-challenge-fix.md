# Work Item 101 — 9xBuddy bootstrap challenge classification and xHamster fallback

## Status

Implementation complete on `codex/wi101-9xbuddy-bootstrap-challenge-fix`; awaiting PR CI and
separately authorized production rollout.

## Root cause

The production xHamster task reached `9xbuddy` once and failed after 182 ms with
`provider_challenge` during the `bootstrap` phase. An NL probe returned a normal HTTP 200 HTML
landing page with `window.__INIT__`, `apiBase`, `appVersion`, and the current CSS bootstrap. The
page also contains the ordinary JavaScript token `challenge-platform`. The shared response
classifier treated that bare token as an access challenge before the 9xBuddy bootstrap parser ran.

The failure is therefore a false positive, not an xHamster URL rejection, token failure, conversion
failure, or Delivery host-policy rejection. LocoLoader was not attempted because its production
gates and xHamster rollout rule remain disabled.

## Implementation

- Add a 9xBuddy-specific landing classifier that ignores embedded `challenge-platform` when valid
  bootstrap markers are present.
- Keep HTTP 403, Turnstile, blocked-page text, and challenge pages without bootstrap classified as
  `provider_challenge`.
- Classify a page with neither valid bootstrap nor strong challenge evidence as
  `provider_schema_changed`, preserving fail-closed behavior.
- Extend internal diagnostics with content type, bootstrap presence, and challenge-marker class;
  never record response bodies, cookies, tokens, source URLs, or signatures.
- Keep the existing 90-second bound, one in-flight request, two-second spacing, one queue attempt,
  exact `ab.9xbud.com` Delivery policy, and no media proxy.
- Keep 9xBuddy at priority 700 and LocoLoader at priority 480. Enable the existing LocoLoader
  xHamster gates and create one `locoloader / xhamster / nl` rule only during the separately
  authorized production fallback verification; its two-extractions-per-six-hours Redis budget
  remains unchanged.

## Verification

- Normal landing fixture includes `challenge-platform` and valid bootstrap and must reach `/token`.
- 403 and Turnstile/no-bootstrap fixtures remain `provider_challenge`.
- Missing-bootstrap/no-challenge fixture is `provider_schema_changed`.
- Router tests prove sequential `9xbuddy → locoloader` fallback and no queue replay.
- Run targeted Provider/Worker/Delivery tests, `pnpm check`, and `git diff --check`.
- After CI and exact-SHA image verification, deploy with backup, verify the supplied xHamster URL
  through a real browser download, then perform one bounded LocoLoader fallback check. Roll back or
  close the 9xBuddy rollout if the bootstrap/token chain or artifact policy fails.

No new database migration, public contract, SEO rule, Provider page handoff, or media proxy is
introduced.
