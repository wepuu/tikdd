# Work Item 141: yt-dlp Dailymotion qualification and impersonation runtime repair

The first production-isolated qualification of the Work Item 140 Runner returned HTTP 422 for
both approved Dailymotion samples before media discovery. Sanitized Runner logs classified both
attempts as extractor failures. A bounded container diagnostic identified the exact missing
runtime: Dailymotion required Firefox request impersonation, while the image contained base
`yt-dlp` without the optional `curl_cffi` implementation.

The Runner image now installs the pinned `yt-dlp` release with its official `default,curl-cffi`
extras and fails its image build unless a Firefox impersonation target is listed. Subprocess errors
classify this missing dependency as `runtime_dependency_unavailable` without logging stderr, URLs,
responses, media locations or headers.

## Production qualification result

The repaired exact-SHA release `c89506c1f69bb145fc15440e8d62ec86c5cfa815` passed the staged
production deployment and the isolated Runner reported a Firefox impersonation target. Both
approved Dailymotion samples then resolved successfully, but neither exposed a progressive MP4:

- the first sample exposed two muxed audio/video HLS variants;
- the second exposed separate HLS audio and video variants that require a bounded FFmpeg merge.

The existing direct and single-upstream relay capabilities therefore cannot provide a complete
download. Returning the first sample's manifest would delegate HLS processing to the browser, and
returning one of the second sample's video streams would create a silent file. Neither result meets
the normalized media contract.

Production remains fail closed: all five yt-dlp gates are false or empty, no
`ytdlp-isolated / dailymotion / nl` rollout rule exists, and the isolated Runner was stopped after
qualification. Dailymotion remains `planned` and no public page or sitemap entry is enabled.

The production backup is
`/var/backups/tikdd/wi141-c89506c/tikdd-prod-20261003T022442Z.dump.gpg` with SHA-256
`1d10582f21a592aa3b1851ce7d65cf8f70c6e2c9167dd1771c8de2b275a1a9b7`; its encrypted off-host copy
is stored under `D:/TikDD-backups/wi141-c89506c`.

## Follow-up boundary

A later work item may add a Runner-owned temporary artifact pipeline: yt-dlp downloads the bounded
HLS inputs, FFmpeg merges when required, and Delivery authorizes a one-time internal pickup. That
changes media delivery and temporary persistence, so it requires a separate ADR and must preserve
the 300 MiB, 180-second, MIME, redirect, DNS, concurrency and cleanup limits. Unlimited VPS transfer
quota does not remove those safety boundaries.
