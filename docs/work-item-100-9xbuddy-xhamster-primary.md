# Work Item 100 — 9xBuddy xHamster primary route

## Status

Implemented locally on top of the WI99 branch. Production gates and rollout remain unchanged.

## Evidence

An NL VPS protocol probe against the authorized public xHamster sample completed the current
9xBuddy sequence without browser state:

- landing page HTTP 200 and dynamic bootstrap accepted;
- `/token` and signed `/extract` returned JSON with a thumbnail and MP4 descriptors;
- MP4 descriptors were provider conversion jobs rather than source CDN URLs;
- `/download` plus bounded `/progress` polling produced an anonymous artifact;
- a new client session with zero cookies read the artifact response, which returned an attachment
  content type, `Content-Disposition`, and Range support;
- the media bytes were not read by TikDD or the NL VPS beyond a 1 KiB probe.

This is a single-sample `resolved` result, not yet repeatable production qualification. A second
public xHamster URL and browser download are required before enablement.

## Implementation

- Added `NineXBuddyProvider` with dynamic bootstrap/token/signature handling, encrypted descriptor
  decoding, one bounded MP4 preparation, progress polling, cancellation, redacted diagnostics,
  and fail-closed schema/host validation.
- Added exact-host Delivery policy `9xbuddy-xhamster-artifact-v1`.
- Added default-off activation gates, platform-scoped configuration, light concurrency/spacing
  protection, and the xHamster route timeout floor.
- Registered 9xBuddy in the Worker and disabled queue replay for the Provider.
- Dailymotion is manifest-visible Lab capability only; no production Delivery policy was added.
- Updated production environment examples and release-script Worker configuration checks.

## Acceptance

Run targeted Provider, Delivery, Worker activation and routing tests, then `pnpm check`. After CI
and exact-SHA image verification, deploy with gates off, enable only the unique `9xbuddy /
xhamster / nl` rule after backup, and verify two real browser downloads. LocoLoader remains the
second route with its existing shared two-extraction/six-hour budget.
