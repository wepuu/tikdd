# ADR-0062: yt-dlp temporary artifact delivery

## Status

Accepted for Work Item 142. Production activation remains separately gated.

## Context

Work Item 141 proved that the approved Dailymotion samples expose HLS rather than a progressive
MP4. One sample contains muxed audio/video variants; the other exposes separate audio and video
variants. A redirect or single-upstream relay would therefore return a manifest or an incomplete
file. The API and general Worker must not run yt-dlp or FFmpeg, and Delivery must not become an
arbitrary filesystem or network proxy.

## Decision

- The isolated Runner may prepare one complete MP4 per resolve task, selecting the best result up
  to 720p. It downloads HLS inputs and permits FFmpeg merge/remux only; video transcoding remains
  out of scope.
- The Runner writes to a dedicated host bind mount. Runner receives read/write access and Delivery
  receives read-only access; Web, API and Worker do not mount it.
- The internal response contains only an opaque artifact id, bounded metadata, size, SHA-256 and
  expiry. Paths, upstream URLs, headers and yt-dlp payloads never cross the Runner boundary.
- Delivery candidates use the existing `temporary-object` mode and the versioned
  `ytdlp-dailymotion-artifact-v1` policy. The encrypted candidate contains the opaque id, expected
  size/hash/MIME and safe filename. Public resolve results contain none of those credentials.
- Delivery accepts only the strict artifact id shape, resolves it under the configured root,
  rejects links and non-regular files, verifies size and checksum, then streams it as an attachment
  through a one-use ticket.
- A file is limited to 300 MiB, preparation to 180 seconds, concurrency to one, store occupancy to
  1 GiB and lifetime to 15 minutes. Startup, periodic and pre-job cleanup remove expired complete
  files and abandoned work directories.
- Dailymotion remains disabled until the exact production image passes both approved samples and a
  browser download audit. YouTube is not approved for artifact preparation by this decision.

## Consequences

The NL VPS carries media bytes only for an explicitly enabled last-resort capability. A failed or
abandoned task may leave a bounded file until the janitor removes it. One artifact is produced
before the result becomes ready, so the first resolution can take up to three minutes. Existing
redirect, client-processing and bounded relay behavior is unchanged.

