# Work Item 92 — SaveFromIns latest strategy and latency recovery

## Status

Implementation branch: `codex/wi92-savefromins-latency`. Production Instagram rollout remains
disabled at the prior containment revision until CI, exact-image deployment, and bounded browser
verification complete.

## Evidence

The current public SaveFromIns client uses a parse request with a direct-first download path. Its
fallback path sends `resource_content` to a second download endpoint and may poll an SSE task. Four
bounded, distinct public Reel checks returned HTTP 200 JSON and at least one direct MP4 in the
top-level resource list. CDN Range checks for the selected direct resources returned non-zero video
responses from already reviewed `cdninstagram.com` or `fna.fbcdn.net` host families.

Observed parse latency ranged from sub-second to approximately twenty seconds. The previous
SaveFromIns manifest timeout was ten seconds, which explains the production `PROVIDER_TIMEOUT`
classification even when the upstream eventually returned a valid direct resource. No Provider
page handoff, user cookie, or complete media address was retained.

## Implementation

- Increase the SaveFromIns manifest timeout to 25 seconds while keeping the global route deadline at
  30 seconds.
- Keep Instagram queue jobs and SaveFromIns failures at one execution with no automatic replay.
- Prefer top-level direct resources when popup/nested siblings are also present; nested resources are
  only considered when the direct list is absent.
- Add sanitized `timeToHeadersMs` and `bodyReadMs` diagnostics alongside the existing total duration.
- Do not implement the Provider's asynchronous download/SSE path in this item; current Reel evidence
  does not require it, and introducing it would add a second upstream state machine.

## Verification and rollback

Run focused tests, `pnpm check`, Compose validation, and `git diff --check`. Deploy only immutable
GitHub images while the Instagram rule is disabled. After deployment, enable the same rule by CAS
only for two sequential browser downloads. Any failure first disables the rule and leaves the three
SaveFromIns gates and all other platform routes unchanged.
