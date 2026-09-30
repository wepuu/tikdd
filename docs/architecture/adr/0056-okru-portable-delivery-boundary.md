# ADR-0056: OK.ru portable delivery boundary

## Status

Accepted for Work Item 118.

## Context

The OK.ru candidate batch exposed a distinction between successful metadata extraction and a
deliverable browser resource. OKGrabber repeatedly extracted multiple progressive MP4 entries from
two public native OK.ru videos, and a resolver-side Range request returned `206 video/mp4` from an
OK CDN. The signed address also carried an origin-IP binding. Replaying the same address from two
independent client exits returned HTTP 400. OKGrabber's advertised download endpoint returned an
HTML page rather than media or a transparent redirect.

ToolSphare returned a successful JSON envelope after a long request, but its sole format URL was an
HTML-escaped OK.ru page descriptor rather than a valid media URL. SaveClips issued an anonymous
nonce but did not produce media in the final bounded check. The remaining candidates did not
produce a reproducible, portable media response.

## Decision

- A successful Provider envelope or resolver-side media probe is insufficient for OK.ru.
- Production eligibility requires two distinct public native samples, a non-empty `200/206`
  `video/*` Range response, and replay of the same candidate from an independent client exit.
- The browser handoff must be an HTTPS GET that does not require Provider cookies, a CSRF-bound
  POST, an interactive challenge, or navigation through a Provider page.
- An address signed to the resolver IP is not a redirect candidate even when it works from NL.
- TikDD will not add an OK.ru media proxy, relay, temporary object, or Provider-page handoff to make
  a candidate pass this work item.
- No OK.ru adapter, Delivery host policy, activation gate, rollout rule, public route, or SEO page is
  created by Work Item 118.

## Consequences

OK.ru remains `planned`. The eight candidates stay in the offline Provider portfolio and explicit
preflight map, with sanitized failure evidence. OKGrabber remains a useful resolver reference but
is blocked for TikDD delivery. SaveClips and ToolSphare can be retested only after an upstream
protocol change yields a portable browser GET; a landing-page or success-envelope change alone is
not sufficient.

## Revisit condition

Open a new work item only when a candidate passes the complete portable-delivery gate using two
distinct native OK.ru samples. A future decision to introduce a controlled media proxy would be a
separate architecture change with its own SSRF, bandwidth, size, concurrency, abuse, and retention
review; it must not be inferred from this ADR.
