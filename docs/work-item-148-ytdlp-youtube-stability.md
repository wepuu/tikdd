# Work Item 148 — yt-dlp YouTube upstream stability

## Scope

This work item repairs the anonymous YouTube path inside the isolated yt-dlp Runner. It does not
enable YouTube production traffic. NoAdsDL remains the primary YouTube Provider and SnapYT remains
closed.

## Root cause

The pinned `yt-dlp 2026.08.19` image is current and Node/EJS challenge execution is available.
The NL Runner nevertheless observed YouTube `429`, `LOGIN_REQUIRED`, missing Visitor Data and no
GVS PO Token provider. Because the Runner and Provider previously returned generic extraction errors,
the Provider recorded these upstream states as `unsupported_url`; intermittent successes and failures
were therefore indistinguishable from routing defects.

## Implementation

- Add the matching `bgutil-ytdlp-pot-provider==2.0.1` plugin to the Runner image.
- Add a private `ytdlp-pot-provider` Compose service on `provider-egress`, with no public port,
  health check, read-only filesystem, dropped capabilities and bounded resources.
- Use a deterministic YouTube `mweb` profile with the sidecar's internal `base_url`; Dailymotion
  remains plugin-free and unchanged.
- Require an exact sidecar image digest before any YouTube-enabled production release.
- Add sanitized Runner error codes and map them to existing Provider failure semantics.
- Add a YouTube-only admission gate with one in-flight request and configurable minimum spacing;
  no automatic replay of the same YouTube task.
- Keep qualification runtime separate from Worker traffic authorization: the release script may
  start the digest-pinned PO Token sidecar for closed-gate qualification while YouTube remains
  absent from `YTDLP_APPROVED_PLATFORMS`.
- Update internal OpenAPI, contracts, fixtures, ADR, Provider documentation and roadmap.

## Validation

- Classify 429, bot challenge, PO Token, Visitor Data, no-media, format, unsupported URL, timeout
  and runtime failures without leaking stderr or source data.
- Verify plugin discovery and actual Token request in a closed Runner test; sidecar failure must
  fail closed.
- Run `pnpm check`, Compose config validation and `git diff --check`.
- With YouTube gates closed, qualify one ordinary public video and one Shorts URL sequentially,
  then repeat once after a short cooldown. Each artifact must be non-zero, playable MP4 with one
  Provider attempt and one-use Delivery ticket.

## Release boundary

Only after the closed-gate proof passes may a separately authorized release add the exact
`youtube:artifact` capability and the unique `ytdlp-isolated / youtube / nl` rule. Any 429, bot
challenge or Token-provider failure closes the rule first and leaves NoAdsDL, Dailymotion and all
other Provider traffic unchanged.
