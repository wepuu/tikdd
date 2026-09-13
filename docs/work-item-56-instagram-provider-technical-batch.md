# Work Item 56 — Instagram Provider technical test batch

Status: complete (2026-09-13)

## Scope

This batch is a bounded, protocol-level inspection from the NL VPS. It does not judge landing-page
copy, request SaveFromIns, bypass login/Cookie/Cloudflare/Turnstile controls, or change a manifest,
rollout rule, Delivery host policy, database, Admin lifecycle, or production traffic.

The probe performed one HTTPS landing request per candidate, followed at most three same-host
redirects, checked DNS/TLS/HTTP status/content type and challenge markers, and inspected forms and
same-origin client bundles for endpoint/method evidence. A candidate could submit at most one
public Reel only after passing that passive gate. No candidate passed the gate, so no Reel parse or
media Range request was sent and no confirmation sample was attempted.

The two normalized public Reel fixtures were supplied only to the one-shot probe; neither source
URL, response body, Cookie, token, query string, or complete CDN URL is recorded in the repository.

## Sanitized NL observations

| Candidate | Passive result | Protocol evidence | Decision |
| --- | --- | --- | --- |
| `fastdl` | DNS/TLS OK; HTTP 200 HTML; one same-host redirect; Cloudflare challenge and browser-storage marker | `fastdl.app` exposed `/api` and localized `*/instagram-reels-download` paths; no server-callable form fields were present | `blocked` — `browser_state_or_challenge`; no parse request |
| `snapinsta` | DNS/TLS OK; HTTP 200 HTML; one same-host redirect; Cloudflare challenge | Same-origin `/api/ajaxSearch`, `/api/get-url`, `/api/userverify`; an external `download.ig-12-data.xyz` `/api/json/convert` was visible. This is the previously observed challenge boundary, not a new Delivery policy. | `blocked` — `access_challenge`; no parse request |
| `igram-world` | DNS/TLS OK; HTTP 200 HTML; one same-host redirect; Cloudflare challenge | `igram.world` exposed `/api` and localized `*/reels-downloader` paths; no anonymous server-callable form fields were present | `blocked` — `browser_state_or_challenge`; no parse request |
| `sssinstagram` | DNS/TLS OK; HTTP 200 HTML; one same-host redirect; Cloudflare challenge | `sssinstagram.com` exposed `/api` and localized downloader paths; no anonymous server-callable form fields were present | `blocked` — `browser_state_or_challenge`; no parse request |
| `inflact` | DNS/TLS OK; HTTP 200 HTML; no redirect; login/signup/reset forms and browser session/storage markers | Login and subscription paths were present; no anonymous downloader protocol was safe to submit | `blocked` — `browser_state_or_challenge`; no parse request |

All observed resources were therefore `0` and valid MP4 resources `0`. Because no candidate reached
`resolved`, none reached `qualified`; the ranking/second-sample step was correctly skipped. The
one-shot probe emitted only provider ID, host/path, method category, status, content category,
timing, redirect count, resource counters, marker categories and sanitized failure code.

## Repository changes

- `provider:preflight` now includes explicit mappings for `fastdl`, `snapinsta`, `igram-world`,
  `sssinstagram` and `inflact`. Temporary HTTP failures (408/429/5xx) classify as `deferred`;
  challenge/authentication remains `blocked`.
- `FREE_PROVIDER_PORTFOLIO` records all four new candidates and refreshes SnapInsta as
  `technicalState=blocked`, `evidenceState=not-evaluated`. None is manifest- or route-eligible.
- Targeted tests cover candidate ID/URL mapping and deferred-vs-blocked classification.
- The NL probe script was removed from both the working tree and VPS after execution.

## Outcome and next step

Work Item 56 closes normally with no production change. SaveFromIns remains the sole Instagram Beta
Provider and its rollout, gates, X/TikTok/SnapTik/TikCD status, Admin, calibration and SEO state are
unchanged. Since this batch produced no qualified candidate, Work Item 57 should not add an adapter;
future candidates must first expose a reproducible anonymous server protocol without browser-held
state.
