# Work Item 46 — TikTok Beta launch batch

## Purpose

Close the disabled SnapTik Monster implementation in Work Item 45 and prepare one controlled
TikTok Beta release. This is a stage-level batch: one pull request, one GitHub-image build, and one
production deployment window. It does not introduce a new media delivery mode or a recurring live
probe.

## Included

- Bilingual TikTok platform content at `/[locale]/tiktok-downloader`.
- Homepage, FAQ, guide, shared legal copy, and metadata updated to identify TikTok as experimental.
- TikTok page content uses the existing platform template, GEO contract, and code-owned source
  registry; the page remains `noindex`, outside the sitemap, and outside hreflang.
- TikTok download names use the existing browser best-effort convention with a `TikDD-TikTok-`
  prefix when the browser accepts the hint.
- Existing SnapTik Monster fixtures, exact `tikcdn.beubagah.com` Delivery policy, activation gates,
  and disabled-by-default behavior remain unchanged.
- Contract, Web metadata, GEO source, route, and no-leak regression tests are included in the same
  batch.

## Release sequence

1. Run targeted tests and `pnpm check` locally.
2. Push the completed Work Item 45/46 branch and create one PR.
3. After CI passes and the owner authorizes merge, wait for Web, Service, and Admin images built by
   GitHub at the exact merge SHA.
4. Back up PostgreSQL and production configuration, then deploy the GitHub-built images with all
   SnapTik gates and rollout disabled. X and Instagram rules remain untouched.
5. Check the six core containers and existing X/Instagram health.
6. After a separate owner approval, set the three SnapTik gates true and CAS-update the unique
   `snaptik-monster / tiktok / nl` rule to `enabled=true`, `allocationBps=10000`, with no expiry.
7. Use one currently public TikTok URL for a browser flow: resolve, choose MP4, redeem the ticket,
   observe the Delivery `302`, and confirm a non-zero file. The browser should fetch media from the
   reviewed CDN; NL Delivery must not stream media bytes.
8. Observe health for 15 minutes, then stop. Do not repeat the live request to increase sample size.

## Rollback

If the browser flow fails, the core containers become unhealthy, repeated 403/429/challenges occur,
or the circuit opens, first set the TikTok rollout to `enabled=false` and `allocationBps=0` with CAS,
then set all three SnapTik gates false. X and Instagram remain enabled. Roll back the application
image only when the failure is attributable to the release itself.

## Explicit non-goals

- No database migration, public upstream URL, generic proxy, cookie or challenge bypass.
- No scheduled TikTok canary or repeated third-party probing.
- No Admin, calibration, or other Provider startup beyond a short, explicitly approved content
  publication session if the owner chooses to publish the landing page snapshot.
- No stable-platform promotion or sitemap expansion.

## Exit

The batch is complete when the merged SHA and production image digests match, the TikTok Beta page
renders in both locales with the noindex boundary, one real browser download succeeds through the
redirect-only path, and the short health watch is clean. After the first ten natural TikTok tasks,
review the existing Admin aggregates. If success remains below 70% or SnapTik shows sustained
blocking, open the next free-Provider validation batch and keep SnapTik as a disabled/low-priority
candidate until another Provider passes the same security and delivery review.
