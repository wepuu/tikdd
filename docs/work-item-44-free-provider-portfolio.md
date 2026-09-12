# Work Item 44 — Free Provider capability expansion and routing optimization

## Scope

Stage 2 is a portfolio and routing batch, not a Provider launch. It prepares a repeatable intake for
free candidates and makes the existing route order respond gently to recent access friction. The
owner remains the only person who can decide whether a candidate proceeds to adapter implementation.

## Delivered

- Added the offline `FreeProviderCandidate` schema and pure qualification function in
  `@tikdd/providers`.
- Added explicit rejection/defer reasons for paid access, login/cookies, interactive challenges,
  non-public content, missing Manifest/Host review, missing fixtures, and missing redirect evidence.
- Added the minimum four negative-fixture rule; resolution-only technical candidates can be assessed
  for implementation but remain explicitly ineligible for production download routing.
- Added an optional access-friction rate to routing health and Admin's sanitized route projection.
  The shared route score applies a maximum 80-point penalty without overriding manual order or a large
  priority gap.
- Added deterministic qualification, routing-score, Router, Redis health, and Admin projection tests.

## Current portfolio decision

The owner supplied a follow-up candidate queue on 2026-09-13. These entries are discovery inputs,
not approved adapters or fallback routes:

- TikTok: `tokvid.io`, `tikvid.cc`, `tikcd.com`, and `tikvid.io`.
- Instagram: `snapinsta.to`, `gramsnap.com`, and `savevid.net/en`.

Each candidate remains untested and disabled until a later bounded feasibility batch reviews its
public/no-cookie/no-challenge flow, deterministic fixtures, exact page/media Hosts, and redirect
delivery. DLPanda remains resolution-only and is not an Instagram download route. SaveFromIns
remains the current owner-approved Instagram Beta; do not increase its live test frequency. Current
rollout rules, gates, Admin lifecycle, calibration, and other Provider flags are unchanged.

## Explicitly not included

- no live third-party request or scraping probe;
- no new adapter, Host allowlist, database migration, public API, or rollout rule;
- no automatic candidate promotion or fallback claim;
- no Admin write-surface expansion, permanent Admin process, calibration, or paid Provider.

## Verification and handoff

Run the targeted provider, route-policy, routing-health, Admin contract/read-model tests and the full
`pnpm check`. A future candidate is accepted only after the owner supplies a URL and it passes the
intake, adapter fixtures, explicit Host/redirect review, delivery verification, and the existing
approval/deploy loop.
