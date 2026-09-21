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

## Protocol drift addendum (Work Item 85)

VidDown later moved its short-lived anonymous token into the HTML page as
`__VID_DOWN_DYNAMIC_PAGE_JWT__` and its page grew beyond the original 64 KiB
read bound. The adapter now prefers that strictly validated inline value and
retains the old token endpoint only as a bounded compatibility fallback. This
does not accept user cookies, login state or persistent tokens, and does not
change the exact media Host policy or redirect-only Delivery behavior.

Both reviewed Vimeo samples returned loader success and MP4 candidates under
the current protocol. The production gates and rollout remain disabled until
browser save behavior is separately proven.

## Challenge-chain addendum (Work Item 86)

The first authorized production handoff after Work Item 85 returned a single
`provider_challenge` before browser download verification. Because the previous
attempt record did not identify the request phase, Work Item 86 adds only
internal, sanitized phase diagnostics and distinguishes an absent inline token
from an invalid token before using the legacy fallback. It also keeps request
chain cookies deduplicated and ephemeral. No challenge bypass, browser token,
user cookie, proxy, public API field or Delivery policy change is introduced.
