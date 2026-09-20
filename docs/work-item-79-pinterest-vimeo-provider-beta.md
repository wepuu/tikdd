# Work Item 79 — Pinterest / Vimeo free Provider expansion and single-platform Beta

## Baseline and scope

Implementation starts from `main@393be36445a9bfd4387a317a01ca91ffef99430d`.
This work item performs a bounded protocol qualification for the supplied Pinterest and Vimeo
candidates, implements only a qualified Pinterest adapter, and leaves Vimeo deferred. It does
not change existing Provider routes or use a media proxy.

All checks are anonymous and sequential. No login, Cookie, CAPTCHA, browser token, paid API,
Provider-page handoff, full media download, or upstream credential is used.

## Technical evidence

| Platform | Candidate | Result | Evidence |
| --- | --- | --- | --- |
| Pinterest | `socialdownloader.space` | blocked | Homepage returned a Cloudflare challenge. |
| Pinterest | `mediafetcher.org` | no-media | `/api/resolve` returned an error for the reviewed sample. |
| Pinterest | `pinsaver.online` | no-media | Anonymous `/api/download` returned a structured extraction error for both samples. |
| Pinterest | `pinterest-videodownloader.com` | resolved | `/api/pin` returned `v1.pinimg.com` MP4 for both reviewed samples; both Range checks returned `206 video/mp4`. |
| Pinterest | `hhhdownload.com` | resolved-conditional | `/api/info` returned media metadata, but delivery requires the site's `/api/stream` relay; not eligible for TikDD redirect delivery. |
| Vimeo | `socialdownloader.space` | blocked | Homepage returned a Cloudflare challenge. |
| Vimeo | `mediafetcher.org` | no-media | `/api/resolve` returned no formats for the reviewed sample. |
| Vimeo | `clipsave.org` | no-media | Public `/info` endpoint returned HTTP 400 for the reviewed sample. |
| Vimeo | `tryunsora.com` | blocked | Public flow exposes Clerk sign-in; no anonymous resolver was available. |
| Vimeo | `whitehole.page` | blocked | The advertised `/api/extract` endpoint returned HTTP 404 HTML. |
| Vimeo | `snapfetchr.com` | no-media | Public flow exposes a `/download-proxy` handoff; no direct anonymous Vimeo media endpoint was observable in the bounded script inspection, so it is not eligible for redirect delivery. |
| Vimeo | `reelsdownloader.in` | blocked | Its public API contract requires an integration credential; the web surface also loads Cloudflare Turnstile. No credential or challenge interaction was attempted. |
| Vimeo | `www.savepanda.io` | no-media | The public page advertises Vimeo support, but the bounded page/script inspection did not expose a callable anonymous resolver or direct media schema; no endpoint was guessed. |
| Vimeo | `snapvideo.cc` | no-media | The public page advertises Vimeo support, but the bounded page/script inspection did not expose a callable anonymous resolver or direct media schema; no endpoint was guessed. |

### Supplemental Vimeo retest

The four additional Vimeo candidates supplied after the initial batch were checked against the
same boundary. The checks remained passive unless an anonymous, documented resolver was visible:
DNS/TLS/HTTP reachability, form and script signals, challenge/login/credential requirements, and
whether a direct CDN response could be identified without guessing an endpoint. No candidate
returned a reproducible direct MP4 suitable for TikDD Delivery. ReelsDownloader's public API
documentation explicitly requires a per-integration client credential, while SnapFetchr exposes
a Provider-side proxy path; both are outside the current no-credential/direct-CDN qualification.
SavePanda and SnapVideo remain protocol-unobservable from the bounded public surface, so they are
recorded as no-media rather than promoted on marketing claims.

The Pinterest winner returned these sanitized facts only: API host/path `pinterest-videodownloader.com/api/pin`,
method `GET`, required field `id`, two MP4 resources on `v1.pinimg.com`, and no credentials.
The source URLs, response bodies, signatures, query strings and complete CDN URLs are not stored
in the repository.

## Implementation

- Added `PinterestVideoDownloaderProvider` with runtime-validated response parsing, short-link
  expansion, exact media-host validation, bounded response reads and typed terminal errors.
- Added the versioned redirect policy `pinterest-videodownloader-pinterest-media-v1`.
- Added default-off activation gates:
  `ENABLE_PINTEREST_VIDEODOWNLOADER_PROVIDER`,
  `PINTEREST_VIDEODOWNLOADER_TERMS_APPROVED`, and
  `PINTEREST_VIDEODOWNLOADER_DELIVERY_AUDIT_APPROVED`.
- Registered the manifest in Worker, API, Admin diagnostics and preflight without enabling it.
- Extended the offline candidate matrix and preflight URL map for this batch.
- Added fixtures, parser, policy and activation tests. No OpenAPI, public result, database,
  sitemap, or existing Provider route changes are included.

## Release gates

1. Run targeted tests, `pnpm check`, `git diff --check`, and production Compose validation.
2. Merge and deploy the GitHub-built image with the Pinterest adapter still disabled; back up the
   database, environment and release manifest first.
3. Verify the Worker revision and all three Pinterest gates inside the container. Existing X,
   Instagram, TikTok and Facebook routes must remain unchanged.
4. In one owner-authorized window, enable the three Pinterest gates and create the unique
   `pinterest-videodownloader/pinterest/nl` rollout rule with 10000 allocation.
5. Complete the two reviewed Pin browser downloads. Each must use one Provider attempt, one-use
   Delivery, a 302 to `v1.pinimg.com`, a non-zero playable MP4, and no Provider page navigation.
6. Observe for 10 minutes. On any failure, disable the rollout first, then the three gates, and
   force-recreate only the Worker through the official release script.

Vimeo remains deferred, is not added to the sitemap, and receives no rollout or production
configuration in this work item.
