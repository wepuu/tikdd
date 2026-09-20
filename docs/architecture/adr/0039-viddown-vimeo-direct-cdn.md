# ADR-0039: VidDown Vimeo direct CDN delivery

## Status

Accepted for the Work Item 83 implementation slice. The VidDown adapter, gates and rollout tuple
remain default-off until a separately authorized browser handoff is completed.

## Context

The Work Item 82 NL probes used two public Vimeo samples and the anonymous VidDown page-token flow.
The API returned `data.links[]` MP4 candidates for both samples; a bounded Range request returned
`206 video/mp4` from the exact `player.vimeo.com` host. Thumbnails were returned on
`i.vimeocdn.com`. The earlier batch note called the media host `vimeocdn.com`; the adapter follows
the latest observed exact host and does not broaden it to a suffix.

## Decision

- Add one Vimeo-only `viddown-net` adapter. It performs a page GET, obtains one anonymous short-lived
  page token, then makes one `getLoaderList` request. User cookies, login state and persistent
  tokens are never accepted.
- Parse `data.links[]` tolerantly. Optional title, author, duration and thumbnail fields may be
  missing; only reviewed HTTPS MP4 candidates on exact `player.vimeo.com` are deliverable.
- Register `viddown-net-vimeo-media-v1` as a redirect-only policy for `player.vimeo.com`.
  Provider API hosts and tokens stay outside Delivery and public results.
- Keep `ENABLE_VIDDOWN_PROVIDER`, `VIDDOWN_TERMS_APPROVED`, `VIDDOWN_DELIVERY_AUDIT_APPROVED` and
  the `viddown-net / vimeo / nl` rollout tuple disabled until browser save behavior is audited.
- Do not add a Vimeo sitemap/content page, proxy, Provider-page handoff, database migration or
  public API change in this slice.

## Consequences

Vimeo has a bounded implementation path that can be audited without changing existing X,
Instagram, TikTok, Facebook, Pinterest, Admin or calibration state. If navigation opens a player
instead of saving a file, the route remains disabled until a separately reviewed client handoff is
implemented.
