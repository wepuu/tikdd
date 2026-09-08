# ADR-0024: Reviewed external result thumbnails

Status: Accepted — 2026-09-08

## Context

The public result contract already contains nullable `media.thumbnailUrl`, but the production
SSSTwitter and SaveFromIns adapters returned null and Web deliberately rendered a neutral platform
icon. Loading arbitrary Provider image URLs would expose visitors to unreviewed hosts and could
carry credentials, redirects, or tracking data. Building a general image proxy, object store, or
video-frame extraction pipeline would be disproportionate for the current MVP.

Bounded production diagnostics using the existing owner-authorized public samples established two
small source-specific paths. The public X page exposes a credential-free `og:image` on the exact
host `pbs.twimg.com`. SaveFromIns exposes `data.thumbnail` on the exact host
`api-ak.savefromins.com`; the observed URL returned `200 image/jpeg`, 48,905 bytes, and no redirect.
SSSTwitter itself exposed no image or poster URL.

## Decision

- A Provider adapter may populate the existing normalized `thumbnailUrl` only after applying its
  own static exact-host policy. Provider data cannot add a host to that policy.
- Public thumbnail URLs must be HTTPS, at most 4,096 characters, use the default port, contain no
  embedded credentials, and have fragments removed.
- SaveFromIns accepts only its observed `data.thumbnail` value and only on
  `api-ak.savefromins.com`. A rejected thumbnail does not reject an otherwise valid video result.
- SSSTwitter performs one best-effort, four-second, 512 KB-bounded metadata GET to the already
  validated X canonical page. It accepts only `og:image` or `twitter:image` on `pbs.twimg.com`.
  Metadata failure never changes video resolution success or fallback behavior.
- Web loads the reviewed URL with a native image element, lazy decoding, and a no-referrer policy.
  An image error restores the existing platform icon in place.
- Thumbnail requests never carry Provider cookies, authorization, or server-held headers. TikDD
  does not proxy, cache, resize, or persist image bytes in this work item.
- The public disclosure states that an available preview image loads from a reviewed third-party
  image host. Media download URLs and secret headers remain private Delivery data.

## Consequences

Result cards show useful real previews for the current X and Instagram Beta routes without a new
database table or service. The visitor's browser contacts the reviewed image host, so the host can
observe normal network metadata; the no-referrer policy prevents TikDD and source-page details from
being sent as the HTTP referrer. Rotated or unavailable thumbnails degrade to the platform icon and
do not block downloads.

A future requirement for private previews, transformations, caching, or hosts needing credentials
must introduce a separate encrypted thumbnail-candidate and controlled-fetch design. This decision
does not authorize a general URL-based image proxy or deriving thumbnails by downloading videos.
