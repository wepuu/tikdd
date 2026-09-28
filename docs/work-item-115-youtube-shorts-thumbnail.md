# Work Item 115: YouTube Shorts thumbnail compatibility

## Outcome

NoAdsDL Shorts results can retain their reviewed YouTube thumbnail when the exact
`i.ytimg.com` image URL carries the observed `sqp` and `rs` parameters. Standard query-free
YouTube thumbnails remain supported, and an invalid thumbnail still falls back to the platform
icon without affecting resolution or delivery.

## Boundary

- Only exact HTTPS `i.ytimg.com` and `img.youtube.com` image paths are accepted.
- `i.ytimg.com` permits at most one non-empty `sqp` and one non-empty `rs` value. Unknown or
  duplicate parameters, credentials, custom ports, fragments and non-image paths are rejected.
- `img.youtube.com` remains query-free.
- Diagnostics continue to expose only the existing acceptance status and never include thumbnail
  URLs or query values.

The existing `noadsdl-youtube-media-v1` navigation handoff is unchanged. TikDD does not proxy
media bytes or guarantee a TikDD filename for Provider-hosted downloads. No public contract,
database, rollout, gate, SEO or UI change is introduced.

## Release verification

Run the NoAdsDL provider tests, the full `pnpm check`, diff validation and production Compose
configuration validation. After exact-SHA deployment, perform service health checks only; the
owner completes the ordinary-video and Shorts browser checks manually.
