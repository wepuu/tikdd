# ADR-0055: NoAdsDL bounded multi-format preparation

## Status

Accepted for Work Items 114 and 115.

## Context

Production browser checks established that NoAdsDL can deliver YouTube media, but TikDD exposed only
one generated MP4 and discarded the thumbnail already present in the metadata response. NoAdsDL
generates a distinct short-lived file for each format, so exposing another format requires another
Provider job. Preparing every advertised format would amplify requests and could exceed the
existing 45-second Provider and 75-second route boundaries.

## Decision

- Parse, normalize and de-duplicate all reviewed combined MP4 offers, ordered as 720p, 1080p,
  480p, 360p, then remaining heights from highest to lowest.
- Prepare at most two offers sequentially. `NOADSDL_MAX_PREPARED_FORMATS` is bounded to one or two
  and defaults to two.
- Both jobs share the existing 40-second preparation budget and twenty-poll ceiling. The primary
  offer must succeed; failure of an optional secondary offer returns the completed primary result.
  No retry, parallel job, queue replay, merge or transcode is introduced.
- Accept metadata thumbnails only from the exact HTTPS hosts `i.ytimg.com` and `img.youtube.com`,
  using default ports and image-file paths without credentials or fragments. `i.ytimg.com` may
  carry the observed single-value `sqp` and `rs` Shorts image parameters; unknown, duplicate or
  empty parameters remain rejected, and `img.youtube.com` remains query-free.
- Diagnostics expose only counts, acceptance booleans, bounded status categories and sanitized
  failure codes. They never expose source URLs, format identifiers, media URLs, cookies or bodies.

## Consequences

Users may see one or two honest combined MP4 choices depending on upstream capability and remaining
budget. A slow or failed secondary generation does not erase a usable primary result. The existing
public contract, Delivery policy, task state, persistence schema and timeout hierarchy remain
unchanged.

Work Item 115 does not change the navigation handoff or claim control over the Provider-selected
download filename. Media bytes continue to flow directly from NoAdsDL to the user's browser.

## Rollback

Set `NOADSDL_MAX_PREPARED_FORMATS=1` and recreate the Worker. If thumbnail behavior regresses,
revert the release; no data rollback is required.
