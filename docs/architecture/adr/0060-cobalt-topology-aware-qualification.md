# ADR-0060: Topology-aware Cobalt delivery qualification

## Status

Accepted for Work Item 131. This refines the qualification rule in ADR-0059; it does not authorize
any production capability or rollout by itself.

## Context

The earlier Cobalt capability matrix used one `crossExitVerified` flag for every result mode. That
rule is correct for `redirect` and direct `picker` results because an upstream media URL can be
bound to the resolver IP. It is not the same test for a signed Cobalt `tunnel`: the browser always
connects to the reviewed TikDD media hostname while the private Cobalt runtime fetches upstream
media from its own fixed exit.

Work Item 130 resolved two TikTok samples as tunnel results. Two independent user exits received
non-zero attachment MP4 ranges with exact Web-origin CORS, while the NL host's request through its
own Cloudflare-fronted public hostname returned HTTP 403. Treating that origin hairpin as a third
source-CDN portability check incorrectly hid the successful client evidence. Treating the two Range
checks alone as production approval would be equally unsafe because the TikDD one-time handoff and
a real browser save were not yet verified.

## Decision

- Record one explicit delivery topology per qualification result:
  `direct-source`, `provider-tunnel`, or `browser-local-processing`.
- Direct-source results require the resolver exit plus independent direct and proxied client exits.
  The existing three-exit portability rule remains unchanged for `redirect` and direct `picker`.
- Provider-tunnel results require independent direct and proxied client exits, the exact versioned
  tunnel Host policy, non-zero ranged video, exact CORS, attachment behavior and private/no-store
  caching. The origin hairpin is recorded independently and is not a source-CDN portability gate.
- Browser-local-processing requires the tunnel checks plus a separate bounded processing audit.
  Work Item 131 does not approve this topology.
- A mode cannot become `qualified-secondary` until the standard one-time TikDD Delivery handoff and
  a real browser save are separately verified. A successful Range probe is not a browser audit.
- Signed tunnel audit inputs are mode-600, UID-1000 temporary files. The audit reads at most 1 KiB
  from at most two descriptors, follows no redirects, prints only sanitized fields and deletes the
  input on exit.
- Cloudflare or origin diagnostics may record whether a request ID was observed, but never the ID,
  signed query, response body, complete media URL, Cookie, header set, or credential.
- Existing stable Providers remain above Cobalt. This ADR changes qualification semantics, not
  route priority, production gates, API contracts, or rollout state.

## Consequences

The evidence model describes what each delivery topology actually proves and no longer calls every
tunnel result a generic proxy-only failure. The current TikTok record advances only to
`resolved-conditional`: its user-exit and boundary checks pass, but browser and one-time handoff
evidence remain absent. Direct-source candidates retain the stricter resolver-plus-two-client rule.

No public contract or database migration is required. Enabling `tiktok:tunnel` still requires a
separate production change that updates the Cobalt key scope, the three Worker gates, the exact
capability and the unique platform rollout rule, with rollback in the opposite order.
