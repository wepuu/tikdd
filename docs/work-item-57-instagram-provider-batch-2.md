# Work Item 57 — Instagram Provider batch 2

Status: complete (2026-09-13)

## Scope and safety boundary

This was a single bounded protocol batch from the NL VPS. The five owner-supplied candidates were
checked in order. The probe used HTTPS, DNS/TLS and HTTP metadata, followed at most three
same-host redirects, inspected forms and client protocol markers, and submitted one normalized
public Reel only when the passive gate did not show browser state or an access challenge. It did
not contact SaveFromIns, use user Cookies or Instagram credentials, bypass Cloudflare/Turnstile,
or retain response bodies, query strings, tokens, or complete media URLs.

The probe script was removed from the local repository and the NL VPS after the run. The two sample
URLs were used only in memory; no source URL is committed.

## Sanitized NL observations

| Candidate | Passive/protocol observation | Single parse result | Decision |
| --- | --- | --- | --- |
| `savefrom-net` (`en1.savefrom.net`) | DNS/TLS OK; HTTP 200 HTML; POST form `/savefrom.php` with fields `sf_url`, `new`, `lang`, `app`; Cloudflare/browser-token markers present | Not submitted because the passive gate failed | `blocked` — `browser_state_or_challenge` |
| `collabstr` | DNS/TLS OK; HTTP 200 HTML; browser-token/storage marker; downloader paths were visible but no anonymous resolver form was established | Not submitted because the passive gate failed | `blocked` — `browser_state_or_challenge` |
| `igexport` | DNS/TLS OK; HTTP 200 HTML; browser-token/storage marker; no anonymous resolver form was established | Not submitted because the passive gate failed | `blocked` — `browser_state_or_challenge` |
| `fastvideosave` | DNS/TLS OK; HTTP 200 HTML; GET form `/` with `url`; no challenge marker | HTTP 200 HTML, zero media resources and zero valid MP4 resources | `no-media` — `no_valid_mp4` |
| `indown` | DNS/TLS OK; HTTP 200 HTML; POST `/download` with `link` and `_token` fields; no challenge marker | HTTP 419; the anonymous CSRF/session chain could not be established in the one allowed request | `blocked` — `csrf_or_session_required` |

No candidate reached `resolved` or `qualified`; no second confirmation sample was attempted. The
ranking step was therefore skipped. The external protocols and paths above are evidence only and
do not constitute an approved Delivery host policy.

## Repository and routing outcome

- `provider:preflight` now contains explicit IDs and URL mappings for all five candidates.
- `FREE_PROVIDER_PORTFOLIO` records `savefrom-net`, `collabstr`, `igexport`, and `indown` as
  `technicalState=blocked`; `fastvideosave` is `technicalState=no-media`. All remain
  `evidenceState=not-evaluated`, disabled and ineligible for implementation/routing.
- Tests cover the new mappings and qualification outcomes.
- No Adapter, manifest, Delivery host rule, environment gate, rollout rule, database migration,
  Admin change, or production deployment was added.

SaveFromIns remains the sole Instagram Beta production Provider. Work Item 57 closes normally with
production state unchanged. A future batch must use new candidates or an objectively changed
anonymous protocol; it should not repeat this batch solely to increase request volume.
