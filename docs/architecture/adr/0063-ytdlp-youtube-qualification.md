# ADR-0063: yt-dlp YouTube closed-gate qualification

## Status

Accepted for Work Item 146. YouTube production activation remains separately gated.

## Context

NoAdsDL is the active YouTube primary and SnapYT remains closed. The isolated yt-dlp Runner already
supports YouTube in its manifest, but production fallback cannot be inferred from extractor support
alone. YouTube may return progressive MP4, provider-bound URLs, HLS, or separated audio and video.

## Decision

- Qualification input accepts only one or two reviewed public YouTube samples and one explicit
  Runner capability: `direct`, `relay`, or `artifact`.
- Samples execute sequentially with a fifteen-second interval matching the Runner's minimum YouTube admission interval and produce only sanitized facts: sample
  identifier, capability, format/candidate counts, reviewed policy IDs, delivery modes, thumbnail
  presence, duration and typed failure code.
- Source URLs, media URLs, artifact IDs, signed query values, headers and response bodies never
  enter qualification output.
- The release script accepts only a mode-600, UID-1000 input at `/run/tikdd/ytdlp-qualification-input.json`.
  The one-shot service has provider-egress access only, uses the Runner HMAC secret, and is removed
  after execution.
- A platform already present in Worker approved platforms or verified capabilities is rejected.
  Qualification therefore cannot silently compete with production traffic.
- Qualification does not create a rollout rule or alter NoAdsDL, SnapYT, Dailymotion or other
  Provider state. A separate release must prove Delivery ticket redemption and browser saving.

## Consequences

YouTube can be evaluated against the actual isolated Runner topology without introducing a public
API or broad media proxy. A successful resolve report is not itself production eligibility: the
exact policy, two-sample Delivery audit, browser save and rollback path remain required.
