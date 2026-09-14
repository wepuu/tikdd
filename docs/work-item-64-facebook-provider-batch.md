# Work Item 64 — Facebook free Provider candidate batch

Status: closed as evidence-only (no production change)

Baseline: `main@028e05e`

## Scope

Three owner-supplied Facebook candidates were evaluated from the NL VPS: FDown.net,
FDownloader.vn and FGet.io. The two previously supplied Facebook samples were used only in the
bounded active step. Each candidate was checked sequentially; no challenge, login, Cookie or
browser-state bypass was attempted, and no full video was downloaded. Instagram testing remained
paused and all existing production routes were left unchanged.

## Results

| Candidate | Passive check | Protocol observation | Active result | Decision |
| --- | --- | --- | --- | --- |
| FDown.net | HTTP 403 HTML | access challenge at origin | not attempted | `blocked` |
| FDownloader.vn | HTTP 200 HTML | same-origin `POST /api/download` with a `url` field | two HTTP 419 JSON responses, no media | `blocked` (anonymous CSRF/session boundary) |
| FGet.io | HTTP 200 HTML | no safe public parser endpoint; static page assets only | not attempted | `no-media` |

The FDownloader.vn endpoint was not treated as usable merely because its method and field were
visible. Both public samples failed before a media URL was returned. The 419 response is recorded
as a session/CSRF boundary, not retried or bypassed. FGet.io's reachable page did not expose a
server-callable parsing protocol, so submitting user samples would add request volume without a
known safe contract.

## Repository and production outcome

- Added explicit candidate mappings to `provider:preflight` and the offline
  `FREE_PROVIDER_PORTFOLIO` with blocked/no-media states.
- Added no Provider adapter, Delivery Host policy, environment gate, rollout rule, database change,
  Admin lifecycle change or production deployment.
- The temporary NL directory and local sample/inspection scripts were removed after the run. No raw
  URLs, response bodies, cookies, tokens, titles, Provider pages or complete CDN addresses were
  persisted.

No candidate reached the `resolved` or `qualified` gate. DLPanda remains unavailable for Facebook in
the current NL access boundary, and no Facebook production route is enabled. The next step is a new,
owner-approved candidate batch or a separately reviewed SocialKit/SaveAPI commercial API feasibility
assessment; existing X, TikTok and Instagram production states remain unchanged.
