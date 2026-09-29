# Work Item 118: OK.ru delivery compatibility POC

## Status

Implemented as an evidence-only closeout. No candidate passed the conditional adapter gate.

## Scope

The work item evaluated eight owner-supplied OK.ru download services from NL using passive protocol
inspection, bounded anonymous requests, one-kibibyte Range probes, and cross-exit replay. It did not
use accounts, user cookies, CAPTCHA bypass, Provider-page handoff, full media downloads, or TikDD
media proxying.

## Result

OKGrabber was the only repeatable resolver: two native OK.ru samples produced progressive MP4
metadata, and NL could read an OK CDN Range. The signed resource was bound to the resolver exit and
failed from both tested client exits. Its Provider download path returned HTML rather than media.
It is therefore blocked for TikDD's redirect model.

ToolSphare and SaveClips remained conditional after initial anonymous success responses. The final
bounded checks produced, respectively, an invalid page descriptor and no media. MediaPuller
candidates returned HTTP 400; A2Z returned no media; the other three candidates had no reproducible
anonymous endpoint.

## Repository changes

- Added all eight candidates to `provider:preflight` and the offline free-Provider portfolio.
- Recorded only sanitized endpoint paths and delivery facts in a runtime-validated evidence model.
- Added a deterministic assessment that requires two samples, verified media Range, cross-exit
  portability, and a browser GET before adapter or production eligibility.
- Added tests preventing a success envelope, resolver-only Range, source-IP-bound URL, Provider
  POST, or Provider page from becoming a production route.
- Added ADR-0056 and the OK.ru Provider evidence record.

## Explicit non-changes

- No Provider adapter, manifest capability, Delivery policy, activation environment variable,
  rollout rule, database migration, OpenAPI change, Admin control, public page, sitemap entry, or
  production deployment.
- Existing X, Instagram, TikTok, Facebook, Vimeo, Pinterest, YouTube, and xHamster routes remain
  unchanged.
- OK.ru remains `planned`; only stable route-qualified pages may enter the sitemap.

## Next decision

Do not spend another batch on these endpoints unless their protocol changes. The next Provider
expansion should target another planned platform with a portable direct or Provider-hosted browser
GET. If an OK.ru candidate later meets ADR-0056, create a new implementation work item rather than
retroactively enabling Work Item 118.
