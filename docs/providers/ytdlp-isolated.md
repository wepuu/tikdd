# yt-dlp isolated Runner

## Current capability

The isolated Runner is an internal `yt-dlp` provider, not a public upstream API. It is currently
enabled only for Dailymotion in the NL region through the reviewed
`ytdlp-dailymotion-artifact-v1` Delivery policy. The Runner prepares one bounded MP4 artifact and
Delivery serves it once as a temporary attachment.

The public result contains normalized media metadata only. Provider URLs, upstream headers,
filesystem paths, cookies, and yt-dlp payloads remain inside the Runner/Delivery boundary.

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
failures. YouTube remains an isolated capability under review and is not activated by this record.
