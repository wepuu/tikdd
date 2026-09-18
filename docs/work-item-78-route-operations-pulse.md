# Work Item 78 — Multi-platform route operations pulse

## Status

Implemented from `main@f94cd78`. This is an Admin read-only operations slice; it does not enable
SocialDownloader/TikTok, call any Provider, change a rollout rule, or add a database migration.

## Decision

The existing sanitized route summaries, effective route plans, and Beta aggregates are sufficient
to show a compact platform-level operating picture. Admin now presents one `平台路由体温` card per
platform with:

- the currently active primary and sequential fallback chain;
- active and healthy route counts;
- weighted success and fallback rates from persisted route samples;
- persisted sample count and most recent observation;
- the matching platform Beta task/attempt summary when available.

Missing samples are labelled `等待自然流量`, and an absent active route is labelled `当前无生产
路线`. Neither state is converted into a successful or failed Provider call.

## Boundaries

- The projection is derived in Web from already sanitized Admin API data; no public endpoint or
  Provider-specific payload was added.
- No source URL, task ID, CDN URL, response body, Cookie, token, or upstream request is rendered.
- SocialDownloader/TikTok remains disabled and Lab-only. X remains its approved secondary route;
  Facebook, Instagram, and the TikTok primary chain are unchanged.
- The existing route plan, capability matrix, Beta health view, and write controls remain the
  authoritative detailed views. The new pulse is a compact summary and does not create a second
  routing authority.

## Verification

- Added pure-model tests for active chains, weighted rates, inactive routes, and missing samples.
- Admin typecheck, repository lint, Admin build, and targeted Admin/contracts tests pass.
- No live Provider probe or local SocialDownloader/TikTok manual test is required.

## Next stage

Work Item 79 may begin a new free-Provider qualification batch. Prioritize an Instagram secondary
candidate or a new YouTube/Vimeo/Pinterest candidate only after a bounded anonymous protocol review;
SocialDownloader/TikTok is not reopened without changed upstream Delivery evidence.
