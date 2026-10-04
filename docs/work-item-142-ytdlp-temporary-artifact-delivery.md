# Work Item 142: yt-dlp temporary artifact delivery and Dailymotion Beta readiness

Work Item 142 implements the missing complete-file path proven necessary by Work Item 141. The
isolated Runner can prepare one best MP4 up to 720p from muxed HLS or separate audio/video inputs.
It uses pinned yt-dlp and FFmpeg inside the Runner container and publishes only an opaque artifact
record. No upstream URL, header, response body or filesystem path enters the public result.

Delivery implements the already-reserved `temporary-object` mode through the versioned
`ytdlp-dailymotion-artifact-v1` policy. It reads the dedicated artifact mount as read-only, validates
the opaque id, regular-file boundary, expected byte length and SHA-256, and returns a TikDD-named
MP4 attachment through the existing one-use ticket. It is not a general filesystem endpoint.

The runtime remains fail closed after merge and deployment. `ENABLE_YTDLP_PROVIDER`,
`YTDLP_RUNTIME_APPROVED`, and `YTDLP_DELIVERY_AUDIT_APPROVED` default false;
`YTDLP_APPROVED_PLATFORMS` and `YTDLP_DELIVERY_VERIFIED_CAPABILITIES` default empty. Production may
set `dailymotion:artifact` only after two isolated samples produce playable files with both audio
and video and the browser handoff succeeds. The exact-SHA production image passed those two
samples and the controlled Delivery audit: each task produced one successful `ytdlp-isolated`
attempt, a non-zero MP4 attachment, and a `410` response when its ticket was replayed. The
resulting rollout is enabled only in NL at 10000 bps. Work Item 143 aligns the catalog and Beta
page with this production fact; the page remains noindex and outside the sitemap until Stable
promotion.

See [ADR-0062](architecture/adr/0062-ytdlp-temporary-artifact-delivery.md).
