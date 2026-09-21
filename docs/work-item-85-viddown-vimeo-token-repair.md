# Work Item 85 — VidDown dynamic token repair and Vimeo Beta validation

## Baseline and scope

This item continues the unmerged Work Item 84 branch at `main@d4e9be3`. The
NL recheck proved that VidDown still resolves the two owner-supplied public
Vimeo samples when the current page protocol is followed: the page contains a
dynamic token, the loader returns MP4 candidates, and a bounded Range request
returns `206 video/mp4` from Vimeo CDN. No production gate or rollout is
enabled by this item.

The earlier adapter was incompatible with the current page because it required
the legacy `/api/get-page-token` response and limited the HTML response to
64 KiB. The current page is about 126 KiB and the legacy endpoint no longer
supplies a usable token.

## Implementation

- Read the page with a bounded 256 KiB limit.
- Prefer the strictly validated `__VID_DOWN_DYNAMIC_PAGE_JWT__` value embedded
  in the page.
- Fall back to `/api/get-page-token` only when the inline token is absent,
  preserving compatibility with an older VidDown deployment.
- Carry only short-lived first-party cookies within the current request chain;
  never persist or log them.
- Add the current `accept-lang` request header while retaining the existing
  language header.
- Keep one loader request per task, exact Vimeo host policy checks, MP4
  validation, and opaque public results unchanged.
- Keep the existing redirect-only policy until browser testing proves whether
  navigation saves the file. Introduce a versioned CORS client handoff only if
  the browser audit requires it.

## Tests and evidence

Provider tests cover a page larger than 64 KiB, inline-token precedence, legacy
fallback, invalid token rejection, request count, and token non-disclosure.
The two NL samples were independently reproduced with the inline token: both
returned `state=0` and reviewed MP4 candidates. The test record contains only
status/shape metadata and no token, source URL, response body, or CDN URL.

The release gate requires targeted tests, `pnpm check`, `git diff --check`,
exact-SHA image verification, and two one-attempt browser downloads. A failed
sample first disables the Vimeo rollout and then the three VidDown gates. Vimeo
remains Experimental/Beta, is not added to the sitemap, and does not change X,
Instagram, TikTok, Facebook, Pinterest, Admin, or calibration state.
