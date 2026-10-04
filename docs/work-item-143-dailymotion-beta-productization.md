# Work Item 143: Dailymotion Beta productization and production-truth closeout

## Baseline and outcome

The baseline is the deployed Work Item 142 merge SHA `1b83e676f28bf6556db9d51dc683023c4ae9b430`.
Its isolated production validation passed for two approved public Dailymotion samples. Each task
used exactly one successful `ytdlp-isolated` attempt and produced a non-zero MP4 attachment through
the one-use artifact Delivery path. This work item aligns the catalog and editorial starter pack
with that already-approved production capability.

## Product changes

- Dailymotion moves from `planned` to `experimental`.
- Every enabled starter locale receives `/dailymotion-downloader` content with a public-video,
  Beta-specific limitation explanation.
- The page is human-accessible but has `indexable=false` and `includeInSitemap=false`.
- No homepage claim, Stable badge, structured-data promotion, or sitemap entry is added.
- The page uses the existing resolver and does not expose the internal Runner, artifact path,
  upstream URL, headers, or provider identity.

## Runtime boundaries kept unchanged

- `ytdlp-isolated / dailymotion / nl` remains the unique active rollout at 10000 bps.
- One Runner job and one Provider attempt per task remain enforced.
- The 180-second, 300 MiB, 1 GiB, 720p, 15-minute TTL, MIME, checksum, and one-use ticket
  boundaries remain unchanged.
- YouTube remains disabled for yt-dlp artifact delivery.
- Existing X, Instagram, TikTok, Facebook, Vimeo, Pinterest, xHamster, Cobalt, Admin, and
  calibration states are unchanged.

## Verification

- Platform catalog and spoof-host tests cover the experimental Dailymotion state.
- Starter content tests cover all nine locales, the new route, Beta copy, and noindex/sitemap
  exclusion.
- Web metadata, sitemap, structured-data, Admin readiness, and public content regressions pass.
- `pnpm check` and `git diff --check` are required before merge.

## Release boundary

This item requires one PR and one exact-SHA deployment after CI. Deployment does not repeat the
Provider samples; the two controlled samples are already recorded in the Work Item 142 release
manifest. After publication, observe natural Dailymotion traffic through the existing sanitized
attempt ledger. Stable promotion, sitemap inclusion, and YouTube yt-dlp activation are separate
future decisions.
