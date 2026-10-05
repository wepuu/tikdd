# ADR-0064: Isolated yt-dlp YouTube anonymous PO Token runtime

## Status

Accepted for Work Item 148. YouTube production activation remains separately gated.

## Context

The isolated Runner is pinned to the current yt-dlp release and already has Node and EJS
challenge support. NL production diagnostics nevertheless show YouTube HTTP 429, LOGIN_REQUIRED,
missing Visitor Data and no GVS PO Token provider. The current internal response flattens these
conditions into `unsupported_url`, which prevents safe fallback decisions and hides the real
upstream state.

## Decision

- Install the exact, matching `bgutil-ytdlp-pot-provider` package in the Runner image and run its
  HTTP provider as a private Docker sidecar. The sidecar is reachable only on `provider-egress`,
  has no published port, and is resource-limited, read-only and capability-restricted.
- Use an exact version and digest for the sidecar image in any YouTube-enabled release. A mutable
  tag is accepted only for local/closed-gate Compose validation; the release script refuses YouTube
  activation without `@sha256:` pinning.
- Configure yt-dlp with a deterministic `mweb` profile and a GVS PO Token provider URL. No account
  cookies, OAuth, browser profiles, CAPTCHA interaction or manually copied tokens are allowed.
- Emit only a bounded internal failure enum for rate limits, bot challenges, PO Token/Visitor Data
  gaps, format absence, runtime errors, timeouts and capacity. Raw stderr, URLs, response bodies,
  tokens and media targets never leave the Runner.
- Apply a YouTube-only in-process admission gate: one request at a time and a configurable minimum
  interval. The gate rejects a burst instead of queueing it, and existing circuit/fallback rules
  remain authoritative.
- Treat the private sidecar's runtime availability separately from Worker traffic authorization:
  the reviewed qualification command may start the digest-pinned sidecar while YouTube is still
  absent from the Worker's approved platform list.
- Keep YouTube as the last yt-dlp fallback below NoAdsDL and SnapYT. This ADR does not create a
  rollout rule, approve a capability, change Delivery, or enable public traffic.

## Consequences

The Runner can use the official yt-dlp PO Token provider boundary without storing user state, while
429/challenge failures become observable and routable. If YouTube still blocks the NL egress after
the anonymous provider is installed, the capability remains closed; rotating IPs or adding user
cookies is not a recovery strategy.
