# Work Item 62 — Free Provider Lab: bounded protocol evidence

Status: closed as evidence-only (no production change)

Baseline: `main@a4b1bd9cf99c76870158ce7d2bd685780fce233d`

## Scope

This batch evaluates the owner-supplied candidates from a server-side protocol boundary. It does
not add an adapter, a Delivery host policy, a rollout rule, a database change, or a production
deployment. No Provider landing page is handed off to users. Existing X, TikTok, Instagram,
Admin, calibration and Provider gate states are unchanged.

The lab is intentionally low-frequency: one sequential request per passive candidate, one bounded
active attempt where an endpoint was already known, a ten-second timeout, a three-hop redirect
limit, public-DNS/HTTPS checks, and a 1 KiB media Range probe. A 429, challenge or upstream 5xx is
not retried in this batch. Response bodies and sample URLs are held only in memory and discarded;
the repository contains no raw response or media fixture.

## Candidate evidence

| Candidate | Boundary checked | Sanitized result | Decision |
| --- | --- | --- | --- |
| Prexzy APIs | `prexzyapis.com` landing; prior `aiov2` evidence retained | reachable; prior WI58 result was one resolved sample, not two-sample qualified | keep as future experimental lead; no adapter |
| AHM7 AllDL | `ahm7xmakki.com` landing | reachable; prior active attempt timed out | unresolved; do not repeat in this batch |
| Cobalt Community Provider Pool | directory API endpoint | blocked, HTTP 403, access challenge | reject for anonymous intake; directory cannot become a runtime pool |
| TikTok Downloader Worker v4 | known worker endpoint with one public TikTok sample | deferred, HTTP 500 JSON, upstream unavailable | transient evidence only; no retry |
| ClipX | documented worker host | reachable HTML; no safe active endpoint confirmed | unresolved; no adapter |
| PostVault | landing host | deferred, HTTP 503 JSON, upstream unavailable | transient evidence only; no retry |
| ClipLatch | `cliplatch.com` landing; prior `/api/parse` evidence retained | reachable; prior WI58 attempt timed out | experimental and unresolved; no adapter |
| TikWM | `tikwm.com/api/` | blocked, HTTP 403, access challenge | reject for anonymous intake |
| AnyDownloader | local source review | local-only; Docker validation not run because the local Docker Desktop daemon was unavailable | out of current redirect architecture |
| ReClip | local source review | local-only; Docker validation not run because the local Docker Desktop daemon was unavailable | out of current redirect architecture |

The Cobalt landing-page reachability observed during an earlier probe is superseded by the explicit
directory API check above; the directory API is the relevant intake boundary and returned an access
challenge. No second Reel confirmation was justified for any candidate in this batch.

## Self-hosted source review

`AnyDownloader` was reviewed at commit `545dd24f7be576c444c63e9176ae0c7df70f27e7`. Its FastAPI
`POST /download` and `/download/stream` endpoints invoke yt-dlp, write media to a local download
directory, and expose files from `/downloads` or `/video/{filename}`. It is a server download and
storage service, not a resolver returning a short-lived upstream URL. The checkout has no license
file, so it is not an adoption candidate without a separate licensing review. Its cookie-file
mount and cookie status endpoints also exceed the current anonymous boundary.

`ReClip` was reviewed at commit `1d161d15a4fe93d9b3371377f0a421dc3e965b10`. Its MIT-licensed Flask
app uses yt-dlp for `/api/info`, `/api/download`, `/api/status/{job_id}` and `/api/file/{job_id}`;
downloads are written to a persistent volume and then served by the application. This is also a
server-side media transfer design and would require a separately approved, resource-limited
yt-dlp/FFmpeg work item. It is not imported into TikDD and was not built or started here.

## Repository changes

- Added `tools/provider-lab/` with a code-owned candidate catalog, bounded passive/active probe,
  SSRF-safe redirect and public-DNS checks, request budget, metadata-only sanitization and tests.
- Added explicit mappings for the remote candidates to `provider:preflight`; local-only sources are
  represented in the lab catalog and are not probed as public Provider endpoints.
- Added the candidates and observed technical states to `FREE_PROVIDER_PORTFOLIO`. These records
  remain offline evidence and do not qualify a production route.
- Added `.tmp/provider-lab/` to the ignore list. Temporary sample input, cloned sources and the NL
  probe directory were removed after testing.

## Outcome and next step

No new candidate reached the two-sample `qualified` gate. SaveFromIns remains the sole Instagram
production route; the existing SnapTik/TikCD TikTok state is unchanged. The next provider batch
should use genuinely new candidates or a demonstrably changed anonymous protocol. If a future
self-hosted candidate is pursued, it needs an explicit ADR and a separate isolated yt-dlp/FFmpeg
resource and retention design rather than being placed behind the current redirect Delivery path.
