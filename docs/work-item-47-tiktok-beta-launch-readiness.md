# Work Item 47 — TikTok Beta launch readiness

Status: implementation complete locally on `codex/wi47-tiktok-beta-launch-readiness`; awaiting PR and production approvals

## Scope

This is one stage-level preparation batch after the production deployment of
`main@cae65866c6391d7e703007481060d3d6f941bcc5`. It prepares the operator console and content
workflow for a TikTok Beta launch without changing production traffic.

The batch includes:

- Admin Beta health aggregates for X, Instagram, and TikTok.
- Privacy-bounded browser analytics accepting TikTok as a platform value.
- Responsive three-platform Beta cards that remain read-only.
- Missing code-owned page prefill in the proofing desk. The TikTok starter record uses the exact
  `/tiktok-downloader` path and remains `noindex`, outside sitemap and hreflang output. Existing
  revisions are always the save base; starter content never overwrites a stored revision.

No database migration, public diagnostic endpoint, upstream URL exposure, media proxy, or provider
activation is part of this item. SnapTik Monster, Admin production profile, calibration, and all
other Provider traffic remain disabled.

## Release sequence

1. Run targeted contract, persistence, Admin, and Web tests, then `pnpm check`.
2. Push one PR and wait for CI. After merge, verify the three GitHub-built GHCR images by exact
   merge SHA and digest; do not use local images.
3. With SnapTik disabled, back up PostgreSQL/configuration and deploy the image. Verify the six
   core containers and existing X/Instagram routes; do not change their rollout or gates.
4. In an on-demand Admin session, select the missing TikTok pages, review the starter content,
   save `content-draft`, mark ready, and publish one full immutable content snapshot. Verify the
   two locales have the exact route and technical SEO flags.
5. Request a separate production approval before activation. Create the unique disabled
   `snaptik-monster / tiktok / nl` rollout rule, then enable only the three TikTok provider gates,
   restart only API/Worker, and CAS-update the rule to 10000 allocation. Prove one real public
   TikTok browser download and observe health briefly.

## Rollback and observation

If activation produces a failed download, repeated 403/429/challenge responses, a circuit opening,
or core-service instability, set the TikTok rule to `enabled=false` and `allocationBps=0` first,
then close the three TikTok gates. X and Instagram remain unchanged. Do not perform repeated live
probes; use the Admin aggregate and the first ten natural TikTok tasks to decide whether SnapTik
can remain the primary free route or whether Work Item 48 should validate another free Provider.
