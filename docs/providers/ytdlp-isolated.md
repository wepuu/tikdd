# yt-dlp isolated Runner

## Current capability

The isolated Runner is an internal `yt-dlp` provider, not a public upstream API. It is currently
enabled only for Dailymotion in the NL region through the reviewed
`ytdlp-dailymotion-artifact-v1` Delivery policy. The Runner prepares one bounded MP4 artifact and
Delivery serves it once as a temporary attachment.

The public result contains normalized media metadata only. Provider URLs, upstream headers,
filesystem paths, cookies, and yt-dlp payloads remain inside the Runner/Delivery boundary.

Artifact metadata may include an optional Dailymotion thumbnail. The Runner applies the same
reviewed image boundary as its normal extraction path: HTTPS with no credentials or custom port
on the exact `s1.dmcdn.net` or `s2.dmcdn.net` host. Missing, malformed, or unapproved images are
discarded and the Web fallback icon remains in effect; thumbnail handling never changes MP4
preparation or Delivery.

## Dailymotion Beta limits

- Public, individually addressable Dailymotion videos only.
- One Runner job at a time and one Provider attempt per task.
- Maximum preparation time: 180 seconds.
- Maximum artifact size: 300 MiB; artifact store ceiling: 1 GiB.
- Maximum artifact lifetime: 15 minutes, with startup, periodic, and pre-job cleanup.
- MP4 output is prepared up to 720p; no video transcoding is introduced.
- Private, removed, restricted, live, playlist, or otherwise unsupported pages may fail.

Dailymotion is an experimental Beta route. The public page is available for human use, but remains
`noindex` and is excluded from the sitemap until a separate Stable promotion review.

## Activation and rollback

Activation requires all three yt-dlp gates, the approved Dailymotion capability, and the unique
`ytdlp-isolated / dailymotion / nl` rollout rule. Disable the rollout first, then clear the gates
and force-recreate the Worker if the route produces unsafe delivery, capacity, or repeated upstream
failures. YouTube remains a last-level fallback under review. Its reserved direct, relay, and artifact
policies do not authorize traffic by themselves. Work Item 150 requires a closed-gate ordinary
video plus Shorts qualification, followed by a separately authorized two-sample browser Delivery
check. During that check NoAdsDL is temporarily removed from the test path so the attempt ledger
proves that yt-dlp was actually exercised; after success NoAdsDL returns as priority 740 and
yt-dlp remains priority 250. SnapYT remains closed.

## YouTube fallback boundary

When activated, the isolated Runner uses priority `250`, below NoAdsDL (`740`) and SnapYT (`720`).
The route is therefore eligible only after a higher-priority Provider returns a typed retryable or
fallback-allowed failure. Login, Cookie, challenge, private-content, schema, and other terminal
errors do not trigger fallback. The approved capability must be exactly one of `direct`, `relay`, or
`artifact`, and its versioned Delivery policy must be recorded in the release evidence.

The qualification runner accepts at most two owner-approved YouTube samples, executes sequentially
with a fifteen-second interval matching the Runner admission guard, and emits sanitized facts only. Its temporary input is mode 600, owned
by service UID 1000, and deleted after the one-shot run. Qualification does not create a rollout
rule or change NoAdsDL traffic.

## YouTube anonymous upstream stability

Work Item 148 adds the official-style `mweb` PO Token path behind a private
`bgutil-ytdlp-pot-provider` sidecar. The sidecar has no public port and is only reachable from the
Runner's provider-egress network. The Runner image pins the matching plugin version, while a
YouTube-enabled production release must pin the sidecar image by digest. A YouTube request is
accepted only one at a time with configurable minimum spacing; the Runner does not replay a task.

The Runner exposes only sanitized failure categories such as rate limit, bot challenge, PO Token
missing, no media, timeout and runtime dependency failure. Account cookies, OAuth, browser profiles,
CAPTCHA interaction, manually copied tokens and raw upstream diagnostics remain prohibited. NoAdsDL
continues to outrank yt-dlp, and the YouTube capability remains closed until the separate artifact
and browser Delivery proof succeeds.
