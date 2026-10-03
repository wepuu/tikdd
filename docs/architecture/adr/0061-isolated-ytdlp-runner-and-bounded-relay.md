# ADR-0061: Isolated yt-dlp Runner and bounded last-resort relay

## Status

Accepted for Work Item 140. Production activation remains separately gated.

## Context

Some platforms expose progressive media that is discoverable with yt-dlp but cannot always be
delivered from a user's network. Running extractors inside Web, API, Worker, or Delivery would
expand those services' attack surface. A generic media proxy would also violate TikDD's reviewed
host-policy boundary.

## Decision

- Run pinned yt-dlp in a separate, non-public container. The Worker calls one HMAC-authenticated
  endpoint with a catalog-approved URL, platform and deadline. The Runner accepts no arbitrary
  options, plugins, cookies, credentials, playlists, shell execution, or output paths.
- Start with Dailymotion and YouTube only. Each platform remains routing-ineligible until its
  runtime, delivery audit, manifest capability and rollout are independently enabled.
- Prefer reviewed direct delivery. A `relay` capability is a last resort and maps to a versioned
  `proxy` candidate with `browserHandoff=server-download`.
- Server download is not a generic proxy. Delivery can fetch only an encrypted candidate created
  by `ytdlp-isolated`, under an exact versioned host policy, after public-DNS validation at every
  redirect. It permits at most three redirects, reviewed MIME types, 300 MiB and 180 seconds.
- Relay request headers are limited by the encrypted secret-header schema. Cookies, authorization,
  proxy headers and browser-controlled target URLs are rejected.
- Only progressive MP4 with audio and video is normalized. HLS, DASH, split streams, live media,
  merging, transcoding and temporary objects remain out of scope.
- GitHub builds the pinned Runner image from the merge SHA. It has no host port, runs without Linux
  capabilities, uses a read-only filesystem and receives only its HMAC secret.

## Consequences

VPS bandwidth is used only for a separately approved last-resort route. Existing providers retain
higher priority. Public results contain no upstream URL or header. Work Item 140 does not enable a
provider, start the Runner in production, create rollout rules, or claim platform qualification.

