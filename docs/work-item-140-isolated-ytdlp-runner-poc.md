# Work Item 140: Isolated yt-dlp Runner POC

TikDD now has a fail-closed implementation boundary for evaluating yt-dlp as a low-priority
Dailymotion/YouTube provider: a signed private Runner, runtime-validated manifest, explicit direct
and relay policies, and a bounded Delivery relay for cases where client delivery is impossible.

All activation values default closed: `ENABLE_YTDLP_PROVIDER`, `YTDLP_RUNTIME_APPROVED`, and
`YTDLP_DELIVERY_AUDIT_APPROVED` are false; `YTDLP_APPROVED_PLATFORMS` and
`YTDLP_DELIVERY_VERIFIED_CAPABILITIES` are empty. Capabilities use `platform:direct` or
`platform:relay`. The Runner additionally requires the `ytdlp` Compose profile and
`/etc/tikdd/secrets/ytdlp_runner_hmac_secret`.

This item does not deploy or activate yt-dlp, change traffic, merge streams, accept cookies, add
unrestricted extractors, or expose a public Runner API. Production remains unchanged.

