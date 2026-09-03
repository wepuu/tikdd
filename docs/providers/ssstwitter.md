# SSSTwitter provider record

- Provider ID: `ssstwitter`
- Site: <https://ssstwitter.com/>
- Kind: third-party site adapter
- Declared platform: `x`
- Default state: disabled
- Technical review: 2026-08-10
- Test authorization: two exact `ssstwitter-x-authorized-001` runs were asserted and consumed on
  2026-08-10; `ssstwitter-x-recurring-001` was authorized on 2026-08-30 for recurring bounded
  scheduled Canary checks until explicit revocation or configuration removal
- Production-use confirmation: recorded for the concrete `nl` deployment in
  `config/x-internal-preflight.json`; production traffic remains blocked by independent runtime and
  evidence gates

## Qualification state

- Qualification tuple: `ssstwitter` / `x` / `global`
- Reviewed routing regions: `nl` (production), `global` (local/historical), `canary-global`
  (isolated technical Canary)
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
  `SSSTWITTER_DELIVERY_AUDIT_APPROVED=true`; the checked-in owner confirmation does not set these
  deployment flags or grant rollout traffic

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

The public site exposes privacy and about pages but no external legal evidence is stored in this
repository. The project owner has separately recorded terms and production-use confirmation for the
concrete `nl` deployment in `config/x-internal-preflight.json`. That record admits the reviewed
Manifest region only; production remains blocked until deployment flags, qualification, rollout,
health, and evidence gates all allow the exact tuple.

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

## P0-X-HTTP-01 request-compatibility correction

The earlier bounded TikDD production diagnostic remains historically valid: SSSTwitter/X/NL was
selected, the Provider request ran, and both bounded attempts ended as `provider_schema_changed`
without a normalized format, candidate or Delivery ticket.

The later hypothesis that NL egress, CDN locality or an apparently old numeric `ts` value caused
that failure is superseded. Owner-operated HTTP A/B diagnostics reproduced the public workflow from
both NL and US hosts. Without a browser-compatible User-Agent the resolve POST returned HTTP 200
with a zero-byte body. From the same NL host, adding only a browser-compatible User-Agent produced a
non-empty `/result_normal?en` response containing `#result` and the reviewed `ssscdn.io` candidate
host. Removing `Accept-Language` while retaining the User-Agent still succeeded. The numeric `ts`
field is therefore treated only as an opaque Provider-issued form value and not as token-age or CDN
health evidence.

An independent owner-operated cross-network handoff check requested exactly one byte from the
resolved CDN candidate and received HTTP 206 with a valid Content-Range. The signed candidate URL
was not retained. This demonstrates that the tested redirect candidate was not bound to the NL
resolver IP and preserves TikDD's direct browser/CDN handoff: no US gateway, Provider proxy or media
relay is required. P0-X-HTTP-01 adds one fixed browser-compatible User-Agent to the SSSTwitter
landing GET and resolve POST only; it does not change the parser, global fetch behavior, other
Providers, delivery policy or public rollout state.

The merged User-Agent repair was deployed on 2026-09-01 as application SHA
`251b02b39c66cc949a299f9f24c7c9533bb85d73` and Service image digest
`sha256:6f8d237ee1af9b64f0a2e14bb7593562b43d335e3807aa221c90bc2e35f6da72`.
The one authorized production verification still produced two fallback-eligible
`provider_schema_changed` attempts (1,265 ms and 972 ms), zero formats, zero candidates and zero
tickets. This does not invalidate the controlled HTTP A/B evidence; it shows that the fixed
User-Agent alone was not sufficient in TikDD's deployed request path. No upstream body was retained,
so the adapter parser and remaining request shape must not be changed without new deterministic,
sanitized evidence and separate authorization. Production rollout remains disabled and allocation
remains zero.

## P0-X-EVIDENCE-01 differential capture

A single authorized isolated invocation on 2026-09-01 used the unchanged production Service image
`sha256:6f8d237ee1af9b64f0a2e14bb7593562b43d335e3807aa221c90bc2e35f6da72`, Node `v24.14.0`, the NL
production host and its Provider-only egress. The real adapter received the canonical SpaceX URL,
completed the normal landing GET, form POST, 301-to-GET transition and Provider-cookie forwarding,
then parsed eight formats and eight `ssscdn.io` candidates. No media/CDN request or Delivery ticket
was made, and the conditional source-URL control was not executed because the primary invocation
succeeded.

This evidence shows that the current request and parser path succeeds in isolation; it does not
explain the earlier Worker task's two `provider_schema_changed` attempts. The remaining differential
is either outside the isolated Provider invocation or was transient upstream behavior at the earlier
time. X remains non-stable, production allocation remains zero, and the Production Evidence Gate
remains open. Full sanitized request/response evidence and lifecycle controls are recorded in
[`../p0-x-download-and-legacy-redirects.md`](../p0-x-download-and-legacy-redirects.md).

## P0-X-E2E-VERIFY-01 Worker revalidation

One bounded NL production Worker task on 2026-09-01 selected only SSSTwitter but ended
`PROVIDER_UNAVAILABLE`. Its two sanitized attempts were fallback-eligible
`provider_schema_changed` failures at 1,010 ms and 1,026 ms. The task produced zero formats, zero
candidates and no Delivery ticket; the public task representation exposed no candidate material.

The single effective conditional isolated control used the same immutable Service image, Node
runtime, host, Provider egress and canonical URL. The actual adapter succeeded with eight formats
and eight `ssscdn.io` candidates. This is Worker-versus-isolated Case B evidence: it correlates the
failure with Worker/Router execution context but does not yet isolate the deterministic variable.
No Provider, request, parser, routing or Delivery code was changed. P0-X-HTTP-01 remains open,
production allocation remains zero, X remains non-stable and the Production Evidence Gate remains
open. Full sanitized lifecycle evidence is recorded in
[`../p0-x-download-and-legacy-redirects.md`](../p0-x-download-and-legacy-redirects.md).

## P0-X-WORKER-CONTEXT-01 isolation result

Two effective, authorized calls ran as separate short-lived processes inside the unchanged running
production Worker container. Direct `SSSTwitterProvider.resolve()` with Worker-equivalent 30-second
route and 18-second Provider signals succeeded in 1,325 ms with eight formats and eight
`ssscdn.io` candidates. The real core `ProviderRouter`, configured with one local allow decision,
closed health, one concurrency permit, no preference override, `production=true` and
`maxAttempts=1`, then succeeded in 1,225 ms with one successful Provider attempt, eight formats and
eight candidates on the same host.

This establishes Boundary C: the actual Worker container namespace, Provider egress, Docker DNS,
safe environment, signal composition, core Router validation, current SSSTwitter HTTP behavior,
parser and canonical URL all work together. The unexplained production task failure is now bounded
to the long-running Worker process or its production runtime integrations. No task, rollout,
Delivery ticket, CDN request, media transfer or runtime change occurred. P0-X-HTTP-01 remains open,
production allocation remains zero, X remains non-stable and the Production Evidence Gate remains
open. Full Phase A differences and lifecycle evidence are in
[`../p0-x-download-and-legacy-redirects.md`](../p0-x-download-and-legacy-redirects.md).

## P0-X-WORKER-TRACE-01 result

Phase A corrected the premise behind the prior boundary: the inspected production Worker started
about 5.3 seconds after the historical failed task had already finished, so it could not have
processed that task. PID 1, Docker and host safe environments matched, and no repository-owned
global fetch/dispatcher mutation was found.

A default-off exact-tuple trace was then deployed only to a fresh Worker. It is restricted to
SSSTwitter/X/NL, an authorized canonical-URL SHA-256, and at most two invocations. Its observer is
sanitized and behavior-preserving; tests prove it emits nothing by default or for a hash mismatch,
does not expose URL/token/cookie/HTML/candidate secrets, and returns the same normalized fixture
result with tracing enabled or disabled.

One authorized production task caused three normal Provider invocations, of which the first two
were traced. Invocation one completed `GET /` 200, `POST /` 301 and `GET /result_normal` 200, then
resolved eight formats and eight `ssscdn.io` candidates. A later untraced downstream error caused
the job to retry before that success was committed. Invocation two received `GET /` 200 followed by
a direct `POST /` 200 with a zero-byte body and failed at result parsing as
`provider_schema_changed`; invocation three ran beyond the trace cap and produced the same typed
failure. Signals were not aborted, active Provider concurrency was one, and there was no challenge
or block marker.

The result is therefore mixed rather than proof of process-lifetime corruption. The current Worker
Provider path can succeed, while SSSTwitter can also return a transient empty success response. A
separate error remains between successful Provider resolution and persisted task completion. This
work item intentionally did not change redirect-body handling, parser, retries, routing,
persistence or Delivery behavior. No ticket, CDN request or media body occurred; production
allocation and all Provider/Canary/trace flags were restored to zero/off. P0-X-HTTP-01 and the X
Production Evidence Gate remain open. Full process, HTTP, lifecycle and restoration evidence is in
[`../p0-x-download-and-legacy-redirects.md`](../p0-x-download-and-legacy-redirects.md).

## P0-X-COMPLETION-EVIDENCE-01 root cause

The retained BullMQ job proves that the first traced SSSTwitter invocation did not fail. It
successfully returned eight formats and eight candidates, and the actual candidate cipher was
configured. BullMQ attempt 1 then entered `TaskRepository.completeWithResolution()` and PostgreSQL
rejected its first write, `DELETE FROM delivery_candidates WHERE task_id = $1`, with
`permission denied for table delivery_candidates`.

Read-only production catalog inspection under the exact `tikdd_worker` identity confirmed
`delivery_candidates` SELECT/INSERT/UPDATE privileges but no DELETE privilege. Public schema usage,
`resolve_tasks` SELECT/UPDATE, `provider_attempts` INSERT and `active_source_admissions` DELETE were
present. The live candidate columns and constraints match the current write model. The Worker had
both delivery encryption settings and constructed its cipher successfully; a local sanitized
eight-candidate call to the real preparation function produced eight valid encrypted
`dvc_<32 hex>` candidates. Neither SSSTwitter parsing, candidate preparation, encryption nor schema
compatibility caused the completion failure.

The transaction rolled back before any candidate, successful attempt or successful result
committed. BullMQ then reran the whole callback twice. Those later SSSTwitter responses failed as
`provider_schema_changed`, and the final failed handler replaced the original local database error
with generic `PROVIDER_UNAVAILABLE`. This is the separately tracked `P0-X-RETRY-MASKING` defect; the
later Provider failures do not change the attempt-1 conclusion.

No Provider, CDN, Delivery or new resolve request was made during this isolation, and no runtime,
image, privilege or production-data change was made. The required repair is deliberately deferred:
one scope must version and verify the Worker's exact completion-path grants, while another must
review retry and truthful terminal-error semantics. P0-X-HTTP-01 remains open, X is non-stable,
production allocation remains zero and the Production Evidence Gate remains open. Full evidence is
recorded in
[`../p0-x-download-and-legacy-redirects.md`](../p0-x-download-and-legacy-redirects.md).

## P0-X-COMPLETION-01 permission repair

Migration `0020_worker_delivery_candidate_delete_grant.sql` now conditionally grants the single
missing `delivery_candidates.DELETE` permission to `tikdd_worker`. The migration is repeatable,
does not grant broad privileges or alter ownership, and is enforced by a repository verifier that
must run with the Worker identity itself.

Production applied the migration through the existing one-shot Compose migration service using
immutable Service digest
`sha256:e913b8ea73aab4fcbcdbee83d92d3c030a38d0e9de65444322b8d7fc52371580`.
The actual production `tikdd_worker` identity then passed public schema usage,
`resolve_tasks` SELECT/UPDATE, `delivery_candidates` INSERT/DELETE, `provider_attempts` INSERT and
`active_source_admissions` DELETE checks. The long-running Worker was not replaced or restarted,
and all six continuous containers remained healthy with zero restarts.

No SSSTwitter or other Provider request, CDN request, Delivery ticket or resolve task was created
for this permission repair. It proves only that the confirmed local persistence blocker is removed;
it does not establish an end-to-end X download. P0-X-RETRY-MASKING-01 and P0-X-HTTP-01 remain open,
X remains non-stable, allocation remains zero and the Production Evidence Gate remains open. Full
deployment and lifecycle evidence is recorded in
[`../p0-x-download-and-legacy-redirects.md`](../p0-x-download-and-legacy-redirects.md).

## P0-X-RETRY-MASKING-01 completion semantics

Provider success does not imply task success. After SSSTwitter returns a validated resolution, the
Worker will not contact it again because candidate encryption or local transactional completion
fails. Instead, TikDD preserves SSSTwitter's successful attempt as `succeeded`, marks the task with
the generic non-Provider `TASK_COMPLETION_FAILED` terminal error and makes the BullMQ attempt
unrecoverable. This keeps Provider health evidence attributable to the actual Provider outcome.

The final queue-failure listener also preserves every existing failed, succeeded or expired task;
`PROVIDER_UNAVAILABLE` is reserved for exhaustion without a successful Provider resolution. This
repair changes no SSSTwitter request, parser, candidate, delivery-host or rollout behavior and does
not resolve P0-X-HTTP-01. Validation is deterministic and generates zero Provider, Delivery or CDN
traffic. Full lifecycle evidence is recorded in
[`../p0-x-download-and-legacy-redirects.md`](../p0-x-download-and-legacy-redirects.md).

Production deployed the merged behavior by replacing only the Worker, from Service digest
`sha256:edb4cf52bcb4ac931f14b250520f126afa4eed054524a3c790544d62a1a781ca`
(`2026-09-01T09:05:16.587009581Z`) to immutable digest
`sha256:271e61bd4d8e958230e7c8864e07102e242c0c9eaa374c79f6b95bf1eee9f6a3`
at OCI revision `9adbe5c93b33cd401743d6a42fb28f8a7e33f931`
(`2026-09-02T14:53:43.316957139Z`). The other five TikDD containers retained their start times;
all six were healthy with zero restarts and the shared-host stage gate passed. SSSTwitter remained
disabled, its X/NL allocation remained zero, and Canary and trace remained off. Deployment and
verification created no X task, Provider request, Delivery ticket, CDN request or media read.
P0-X-RETRY-MASKING-01 is therefore complete; P0-X-HTTP-01 remains open.

## Pilot closure evidence

The sanitized cross-provider operational evidence index is
[`config/x-pilot-evidence.json`](../../config/x-pilot-evidence.json). Its status remains `pending`;
technical canary and delivery-lifetime evidence do not establish production/commercial approval or
satisfy the required seven consecutive daily reviews.
