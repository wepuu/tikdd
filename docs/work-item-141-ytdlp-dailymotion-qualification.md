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

Production activation remains fail closed. After CI and exact-SHA image verification, repeat the
two-sample isolated qualification with the Worker gates and rollout closed. Only a successful
progressive-MP4 media audit may select `dailymotion:direct` or the bounded last-resort
`dailymotion:relay` capability. The relay retains the 300 MiB, 180-second, MIME, redirect, DNS and
versioned-host-policy limits even though early testing is not constrained by VPS transfer quota.
