# Work Item 65 — mixed free Provider technical batch

Status: closed as evidence-only (no production change)

Baseline: `main@37c53fd`

## Scope and limits

Four owner-supplied sites were evaluated from the NL VPS using the bounded Provider Lab. The run
used transport and client-script evidence rather than landing-page claims. Requests were sequential,
used a ten-second timeout and no retry, and did not bypass login, Cookie, CAPTCHA, challenge or
browser-state boundaries. Only previously supplied public samples were submitted after a concrete
anonymous protocol was identified. Media checks used at most `Range: bytes=0-1023`; no complete
media file was downloaded.

## Results

| Candidate | Observed protocol | Active evidence | Decision |
| --- | --- | --- | --- |
| Instagram Video Downloader (Vercel) | form-encoded `POST /api` with `postUrl` | HTTP 404 HTML; no media | `no-media` |
| ReelSaver.fun | `GET /api/download` with `url` | HTTP 422 JSON; no media | `no-media` |
| FDown Isuru | JSON `POST /download` with `url` and reviewed `quality=best` | both Facebook samples returned HTTP 200 JSON; each exposed four media resources that passed public-DNS and bounded Range checks on the `fbcdn.net` suffix | `resolved`, preferred follow-up candidate |
| ViDown (Netlify) | frontend calls a separate API origin with JSON `POST /api/v1/ig` or `/api/v1/fb`, body field `urls` | Instagram returned HTTP 403 JSON; Facebook timed out at ten seconds | `blocked` for Instagram and `deferred` for Facebook; not usable in this batch |

FDown Isuru is technically callable from NL and reproduced resolution on two samples, but it is not
yet a TikDD production Provider. No exact success/failure fixtures, adapter manifest, parser,
Delivery Host policy or browser handoff have been reviewed. It therefore remains
`technicalState=resolved`, with implementation and production routing deferred to a later work item.

## Repository and production outcome

- Added explicit mappings and offline portfolio records for all four candidates.
- Extended Provider Lab POST support for reviewed form encoding and static body defaults while
  preserving the six-request budget.
- Added no adapter, environment gate, rollout rule, database change, Admin change or deployment.
- Existing X, Instagram, TikTok and other production routes remain unchanged.
- Temporary sample and inspection files were removed from the workstation and NL VPS. No sample
  URL, response body, Cookie, Token, title, author, query string or complete CDN URL was committed.

Recommended next work is a single Facebook Provider implementation batch for FDown Isuru: obtain
sanitized real fixtures, implement a tolerant adapter, explicitly review `fbcdn.net` delivery hosts
and redirects, then keep the route disabled until browser Delivery validation is approved. The
other three candidates should not be retried without evidence that their public protocol changed.
