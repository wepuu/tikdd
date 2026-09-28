# Work Item 116 — YouTube Beta productization and public route

## Status

Implementation branch: `codex/wi116-youtube-beta-productization`
Baseline: `main@4fde039c35a000e7ff0d8592f45507a5cdfed50f` (WI115)
Scope: public content, localized product copy, sitemap eligibility and Admin support truth.

## Production evidence

NoAdsDL is the enabled YouTube primary at full allocation with its three runtime gates enabled.
The owner completed ordinary-video and Shorts browser checks on the exact WI115 release, including
the reviewed Shorts thumbnail shape. SnapYT remains a disabled secondary candidate. This record
does not claim stable status, a long-term success rate or a second production Provider.

## Product changes

- Add `youtube` to the reviewed nine-locale starter platform set.
- Publish `/{locale}/youtube-downloader` using the existing platform template.
- Add YouTube to homepage, FAQ, shared support copy and the Admin support-truth ledger.
- Keep the catalog lifecycle `experimental` and display the Beta label.
- Describe public videos and Shorts only; private, paid, DRM, restricted, live and unavailable
  content remain out of scope.
- Keep the existing Download action, NoAdsDL asynchronous route, Provider-stream Delivery policy,
  thumbnail policy and browser handoff unchanged.

## SEO and publication boundary

YouTube uses the existing route-qualified publication gate. The page enters the sitemap and emits
canonical URLs, reciprocal hreflang, `x-default` and structured data only when the production route,
Delivery, locale coverage, reviewed GEO content and immutable snapshot checks pass. No YouTube-only
SEO exception is introduced. Task and result pages remain noindex.

The Admin starter preview/apply flow remains the single content publication path. No database
migration, new API, new audit model, Provider request or rollout mutation is part of this work.

## Verification

- Nine locale page records, platform content, GEO review state and SEO fields pass contracts.
- Homepage and public copy mention YouTube without exposing Provider IDs or upstream URLs.
- `/youtube-downloader` canonical, hreflang, structured data and sitemap tests pass.
- Admin support truth reports YouTube, its active NoAdsDL route and its content/index state.
- Existing NoAdsDL, SnapYT-closed, delivery-ticket and route-policy tests remain green.
- Run targeted tests, `pnpm check`, `git diff --check` and production Compose validation.
- Do not make synthetic NoAdsDL requests during CI or deployment; owner performs one ordinary-video
  and one Shorts browser check after publication.

## Release

One PR and one deployment. Back up PostgreSQL, configuration and release manifest; deploy exact
GitHub SHA images; publish one reviewed content snapshot in the existing Admin `full` workflow; and
observe core/Admin health. Keep NoAdsDL gates and rollout unchanged, SnapYT disabled, calibration
stopped and all other Provider states unchanged.

## Next stage

After WI116, evaluate a second YouTube Provider (starting with a bounded SnapYT repair review or a
new free candidate). Promote YouTube to `stable` only after a repeatable secondary route and natural
traffic evidence justify that lifecycle change.
