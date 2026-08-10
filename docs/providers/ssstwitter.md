# SSSTwitter provider record

- Provider ID: `ssstwitter`
- Site: <https://ssstwitter.com/>
- Kind: third-party site adapter
- Declared platform: `x`
- Default state: disabled
- Technical review: 2026-08-10
- Test authorization: two exact `ssstwitter-x-authorized-001` runs asserted and consumed on
  2026-08-10; future live runs require a new assertion
- Production approval: not established; production enablement remains blocked

## Qualification state

- Qualification tuple: `ssstwitter` / `x` / `global`
- Reviewed routing regions: `global`, `canary-global`
- X routing priority: 800 (secondary)
- Lifecycle stage: `canary-ready`
- Qualification owner: `project-owner`
- Evidence owner: `project-owner`
- Rollout operator: `project-owner`
- Rollback owner: `project-owner`
- Page hosts: exact `ssstwitter.com` and `www.ssstwitter.com`
- Media host: exact `ssscdn.io`, observed from corrected-parser canary HTML only
- Implemented host policy: `ssstwitter-media-v1`, exact `ssscdn.io`, redirect only, no wildcard;
  deployment remains blocked by independent runtime gates
- Delivery behavior: exact `ssscdn.io`, immediate HTTP 200, no redirect, no required secret headers,
  generic `application/octet-stream`, and four-minute observed link availability
- Delivery candidate coverage: complete in sanitized fixtures; every normalized format maps to one
  four-minute internal redirect candidate with empty secret headers
- User credentials: none accepted; public posts only
- Provider session state: only provider-issued page cookies may flow between the reviewed GET and
  POST; they never become delivery credentials or public fields
- Rate and concurrency: one bounded qualification request at a time; no production rate approved
- Kill switch: adapter manifest and `ENABLE_SSSTWITTER_PROVIDER` default to false. Registration also
  requires `SSSTWITTER_TERMS_APPROVED=true` and
  `SSSTWITTER_DELIVERY_AUDIT_APPROVED=true`; neither approval is currently established

## Public workflow observed

The homepage uses an HTMX form that posts back to `/` on the same exact site. It submits the X URL
as `id`, locale `en`, and short-lived `tt`, `ts`, and `source` values embedded in the current landing
page. The qualification adapter fetches a fresh form, forwards only the provider-issued page cookie,
and submits one URL-encoded request. It follows redirects only while the final page remains on the
exact reviewed SSSTwitter hosts.

The public site says it accepts public X posts without an account and that private accounts are not
supported. TikDD does not accept or forward an X account cookie and does not attempt to bypass
private content, access challenges, or rate limits.

## Approval boundary

The public site exposes privacy and about pages but no reviewed terms that grant automated
production or commercial integration. Project-owner authorization permits only the configured
technical canary. Production remains blocked until a separate approval is recorded.

The adapter now has a code-level worker registration path, but it is fail-closed behind three
explicit settings. It emits a public normalized result plus server-only delivery candidates; only
the public result can cross the API boundary. Candidate targets are accepted only when the exact
hostname matches the static `ssstwitter-media-v1` policy.

## Initial canary evidence

The first authorized direct canary on 2026-08-10 completed in 6,895 ms, but its result is invalid as
qualification evidence. The initial parser scanned the complete response and misclassified four
footer product links alongside one apparent media host, producing five false/ambiguous formats. It
did not follow or download any of those links.

The parser now requires a complete `#result` element and scans only that subtree. Missing or
incomplete result markup becomes `provider_schema_changed`; page-wide links can no longer become
formats. Sanitized fixtures include the observed footer-link classes and prove they are excluded.
The project owner explicitly approved one corrected-parser repeat. It succeeded in 4,931 ms with two
normalized formats and the single sanitized candidate hostname `ssscdn.io`; the four footer product
domains were absent. No media link was requested or followed. This advances the exact X/global
qualification tuple to `canary-ready` and selects SSSTwitter as the second X implementation
candidate.

The repeat authorization was consumed and its tuple removed from executable canary configuration.
The `ssstwitter-media-v1` policy and complete candidate mapping are implemented and covered by
sanitized tests. The maximum candidate lifetime is four minutes, matching the bounded live evidence
described below. Work item 10.2 is technically complete, but the route cannot advance to `internal`
without the independent production/commercial approval required by ADR-0008.

One separately authorized delivery-audit run was attempted on 2026-08-10. Page resolution failed as
`provider_unavailable` after 15,830 ms, before candidate creation. Consequently, the runner made
zero media `HEAD` requests. The authorization was consumed and the executable tuple removed; this
run does not satisfy the delivery-evidence gate and was not automatically retried.

The project owner subsequently authorized one retry under the same boundary. It again failed during
page resolution as `provider_unavailable`, after 13,923 ms, and issued zero media `HEAD` requests.
The retry authorization was consumed and its executable tuple removed. At that point, live delivery
evidence was still absent.

A separately authorized retry through the confirmed local v2rayN proxy succeeded on 2026-08-10.
Resolution produced two formats in a 3,539 ms total run and only the exact `ssscdn.io` candidate
host. One manual-redirect `HEAD` was sent to each candidate: both returned 200, no `Location`, no
required secret request headers, and `application/octet-stream`. The declared sizes were 2,100,269
and 1,040,035 bytes; HEAD latency was 1,441 and 1,032 ms. No media body was requested or transferred.

This established the exact host, immediate accessibility, no-redirect behavior, generic binary
MIME, and absence of required secret headers for the observed pair.

A final bounded lifetime audit resolved one fresh candidate and sent one HEAD immediately and one
after 240,000 ms. Both returned 200, no redirect, `application/octet-stream`, and the same declared
length of 2,100,269 bytes; latency was 1,332 and 1,012 ms. No body was transferred. The adapter's
maximum candidate lifetime is therefore reduced from five to four minutes. Delivery evidence is
technically approved, but the runtime flag remains false in default configuration and production
still requires the separate terms/approval gate.

## Monitoring and failure policy

- Monitor missing/changed `tt` and `ts` form values, challenge responses, 429s, parse failures,
  empty results, unexpected media hosts, and p95 latency.
- Private/deleted content is terminal and cannot trigger fallback intended to bypass the outcome.
- Challenges, rate limits, timeouts, and schema changes are retryable and fallback-eligible within
  normal route budgets.
- Normal resolution never follows or downloads a parsed media link. The separate delivery-audit
  mode is opt-in and must have exact authorization for each run.
## Pilot closure evidence

The sanitized cross-provider operational evidence index is
[`config/x-pilot-evidence.json`](../../config/x-pilot-evidence.json). Its status remains `pending`;
technical canary and delivery-lifetime evidence do not establish production/commercial approval or
satisfy the required seven consecutive daily reviews.
