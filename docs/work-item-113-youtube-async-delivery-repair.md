# Work Item 113 — YouTube asynchronous completion and stateless delivery repair

## Production evidence and containment

The deployed Work Item 112 route correctly called both Providers. NoAdsDL selected three sparse
formats and created one job, but ten polls ended in `provider_timeout`. SnapYT then parsed 26
descriptors and rejected five media probes; the adapter diagnostic was `invalid_result`, while the
shared 30-second route deadline overwrote the persisted attempt as `provider_timeout`.

Before implementation, the existing unique production rules were CAS-disabled without creating
duplicates:

- `noadsdl-youtube-nl`: revision 1 to 2, disabled, allocation 0, snapshot revision 87;
- `snapyt-app-youtube-nl`: revision 1 to 2, disabled, allocation 0, snapshot revision 88.

The Provider process gates remain unchanged. Other platforms and Admin were not restarted or
modified.

## Bounded protocol review

Two existing public YouTube samples each produced a NoAdsDL combined 720p job that moved from
processing to completed after two polls and about 4.2 seconds. No media body was downloaded. The
adapter therefore keeps NoAdsDL as the primary but allows bounded generation-latency variation.

SnapYT returned the same first redirect with and without its anonymous same-session Cookie. The
chain was `www.snapyt.app` to `redirector.googlevideo.com` to a dynamic Googlevideo host, whose
bounded media request returned 403. No source URL, redirect URL, query, Cookie, nonce, response
body or media bytes were stored. The existing exact Provider-stream policy is not widened and the
SnapYT production rule remains closed.

## Implementation

- NoAdsDL uses a 40-second poll budget, at most twenty status requests and one Provider job. Its
  manifest timeout is 45 seconds. Terminal completion without a reviewed media URL is schema drift.
- Sanitized NoAdsDL diagnostics add job-status and progress buckets.
- YouTube receives a 75-second Worker route floor and a 90-second Web polling window; other
  platforms retain their existing windows.
- Router error precedence preserves a typed Provider failure when the shared deadline expires at
  the same boundary.
- SnapYT keeps rejecting redirects, but diagnostics now separate redirect, policy, status, HTML,
  MIME, disposition and empty-response rejections.

There is no public contract, OpenAPI, database, Delivery transport or media-host-policy change.

## Verification and release boundary

Unit coverage includes completion after more than ten polls, completed-without-media schema drift,
YouTube Worker/Web timing alignment, typed-error precedence and SnapYT redirect diagnostics. Run
the focused suites, `pnpm check`, production Compose validation and `git diff --check` before
handoff.

After an exact-SHA deployment, keep both rollout rules closed. Qualify NoAdsDL alone with two real
browser downloads before CAS-enabling only its rule. SnapYT stays disabled unless a later work item
proves a narrow stateless delivery target; its failure does not block a NoAdsDL-only YouTube Beta.
