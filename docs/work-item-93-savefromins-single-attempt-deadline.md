# Work Item 93 — SaveFromIns single-attempt deadline alignment

## Status

Implementation branch: `codex/wi93-savefromins-single-attempt-deadline`. The production
SaveFromIns/Instagram/NL rule is disabled at revision 20 with zero allocation, and all three
SaveFromIns runtime gates are false while this change is reviewed and deployed.

## Production evidence

The exact Work Item 92 image was deployed successfully and all core services remained healthy. The
first controlled Instagram validation produced exactly one SaveFromIns attempt, ending as
`provider_timeout` after about 25 seconds. No Delivery ticket was created. Containment ran
immediately: the rule was disabled first, then the three gates were closed and Worker configuration
was re-applied.

One subsequent no-retry NL diagnostic used the same anonymous parse protocol while public routing
remained disabled. It returned HTTP 200 JSON, one top-level direct resource, and a successful
envelope in about five seconds. Only status, content-type category, timing, byte count, envelope
class, and resource counts were retained. No source URL, response body, token, Cookie, request
header, or complete media address was recorded. This evidence supports an intermittent latency
classification rather than another parser or Delivery change.

## Implementation

- Raise only the SaveFromIns manifest timeout to 40 seconds.
- Apply a 45-second minimum route budget only to Instagram; every other platform keeps the existing
  configured route budget.
- Let Web poll for 60 seconds at the existing 750 ms cadence so the client outlives the Worker
  deadline.
- Preserve one queue execution, no SaveFromIns automatic retry, direct-first parsing, existing
  circuit behavior, and `savefromins-instagram-media-v2`.
- Do not add the Provider asynchronous download/SSE path, another Provider, a media proxy, or any
  public contract/database change.

## Verification and release

Run focused Provider, Worker, and Web tests; `pnpm check`; Compose validation; and
`git diff --check`. Deploy only exact GitHub-built images with the route and gates closed. After
deployment, temporarily reopen the existing rule and gates for at most two sequential browser
downloads. Stop after the first failure. Successful closeout requires one Provider attempt and a
non-zero browser media transfer for each sample, followed by a short health check.
