# Work item 10 implementation plan

> Historical plan. ADR-0020 supersedes its elapsed-time launch gates and former client
> acknowledgement while retaining Provider, delivery, rollout, and network safety boundaries.

## Outcome

Work item 10 turns the production-shaped X path into a controlled pilot with two real providers.
The user-facing promise stays narrow: an authorized public X URL either reaches normalized formats
and controlled redirect delivery, or fails with a useful generic state. Provider identity,
fallback decisions, upstream URLs, and operational policy remain outside the consumer experience.

This phase does not broaden TikDD to TikTok, YouTube, yt-dlp, proxy delivery, or indexable platform
pages. Those expansions begin only after the X pilot produces reviewed reliability evidence.

## Current constraints

- TwitterSaver is the only adapter with a reviewed redirect candidate and exact media-host policy.
- DLPanda declares X capability but currently emits no delivery candidates and encountered a
  provider challenge from the reviewed execution region.
- The project owner authorized the configured TwitterSaver/X and DLPanda/TikTok canary pairs for
  bounded technical testing. The provider records do not yet contain production/commercial approval,
  and the authorization does not imply a DLPanda/X pairing.
- Work items 8 and 9 provide tuple health, circuits, audited percentage rollout, quotas,
  concurrency, cleanup, protected diagnostics, and metadata-only canary persistence.
- The selected multilingual resolver flow is already implemented. Work item 10 should preserve that
  visual direction and improve only states proven deficient by real pilot evidence.

Production traffic therefore remains denied until the approval, delivery, reliability, and product
experience gates below are all satisfied.

## Delivery sequence

### Work item 10.0 — Provider qualification and pilot-control ADR

Status: complete on 2026-08-10.

[ADR-0008](architecture/adr/0008-provider-qualification-and-pilot-controls.md) fixes the provider
qualification lifecycle, separates technical-test authorization from production approval, requires
three complete internal calibration days before numeric SLOs are locked, and keeps promotion under
operator control. Automatic evaluation uses an independently audited guard that can only hold,
reduce, or deny an existing rollout grant; it cannot create permission, raise allocation, widen a
manifest or host policy, clear itself to restore traffic, or override an operator deny.

The ADR defines:

- the lifecycle `candidate → fixture-ready → canary-ready → internal → limited → stable → paused`;
- independent approval for technical testing and production/commercial operation;
- the evidence required to select DLPanda or another provider as the second X route;
- reviewed page-host and media-host policies, redirect behavior, credentials, retention, and owner;
- a three-day internal calibration period before numeric SLO thresholds are locked;
- promotion and rollback inputs: resolution success, p95 latency, fallback depth, challenge rate,
  invalid-result rate, candidate coverage, ticket creation, and redirect validation;
- minimum sample handling so sparse traffic cannot appear healthy;
- automatic rollback authority, audit records, cooldown, operator override, and deny precedence;
- privacy-safe evidence: no submitted URL, media metadata, candidate, cookie, header, or raw payload.

Exit gate:

- ADR review proves that provider health cannot grant rollout permission, rollout automation cannot
  widen manifest or host policies, and an operator deny always wins.
- The ADR fixes evidence-owner and rollback-owner responsibilities and requires the selected
  provider record to assign concrete opaque owner IDs without storing external legal evidence,
  personal names, or secrets in the repository.

### Work item 10.1 — Second X provider qualification

Status: complete on 2026-08-10. SSSTwitter is selected as the second X implementation candidate.

Evaluate DLPanda first because it already has an adapter and bounded test authorization. Treat it as
a candidate, not the predetermined winner. The current canary configuration pairs DLPanda with the
authorized TikTok input, not the X input, so it does not yet authorize a live DLPanda/X request.

1. Record an explicit provider/platform/input authorization for the DLPanda/X canary, or for another
   selected provider/X candidate, before making the live request.
2. Run only that exact authorized X pairing from explicitly reviewed regions; never bypass a
   challenge.
3. Record page protocol, response shape, media hostnames, link lifetime, redirects, required
   headers, and failure classes as sanitized facts.
4. Reject the candidate if delivery needs user cookies, account credentials, challenge solving,
   an unbounded host wildcard, or an unsupported proxy mode.
5. If DLPanda cannot meet the gate, select another explicitly authorized X provider and create its
   provider record before implementation.
6. Keep all real adapters disabled by default and production-denied throughout qualification.

Current evidence:

- The canary configuration is version 2 and supports an exact `CANARY_ID` selector intersected with
  the optional provider filter, preventing a qualification run from broadening to other inputs.
- Deterministic DLPanda/X routing and error-decision tests pass; the tuple is `fixture-ready`.
- The project owner explicitly authorized one DLPanda/X request on 2026-08-10. It returned
  `provider_challenge` after 1,467 ms without media requests, provider fallback, or challenge bypass;
  the one-time tuple was removed from executable configuration after the run.
- Media hosts, link lifetime, redirects, and candidate coverage remain unknown. The current region
  is paused, and production/commercial approval remains not established.
- Work item 10.1 cannot close until another explicitly authorized X provider passes the same
  qualification boundary, or DLPanda passes from a separately reviewed and authorized region.
- SSSTwitter is the next authorized candidate. Its first direct canary resolved in 6,895 ms, but the
  initial parser mixed footer product links into five apparent formats. No media link was followed.
  The parser is now restricted to a complete `#result` subtree; one explicit repeat-canary approval
  was granted. The corrected repeat succeeded in 4,931 ms with two normalized formats and only
  `ssscdn.io` as sanitized host evidence. No media link was requested. SSSTwitter is now
  `canary-ready`; delivery behavior and candidate mapping remain work item 10.2.

Exit gate:

- One second provider has documented test and production approval states, supported X variants,
  exact host policies, credential boundary, regional behavior, rate/concurrency expectations,
  canary ownership, and kill switch.
- Sanitized success and failure evidence is sufficient to implement without copying a live response
  or sensitive media data into fixtures.

### Work item 10.2 — Production-complete adapter and delivery mapping

Status: complete on 2026-08-10. The offline boundary is implemented: exact page and media host
policies, bounded manual redirects, HTML MIME validation, complete format/candidate parity,
four-minute evidenced expiry, typed failures, secret-redaction checks, and fail-closed Worker
activation gates all pass. The provider remains disabled because independent production/commercial
approval is not established. One authorized audit
attempt on 2026-08-10 stopped at page resolution with `provider_unavailable` after 15,830 ms and
therefore issued zero media HEAD requests; its one-time authorization was consumed without retry.
One separately authorized retry also stopped at page resolution with `provider_unavailable` after
13,923 ms and issued zero media HEAD requests. Both executable tuples have been removed.

A third explicitly authorized attempt used the confirmed local v2rayN proxy and succeeded in 3,539
ms. It produced two `ssscdn.io` candidates; one HEAD per candidate returned 200, no redirect,
`application/octet-stream`, declared lengths of 2,100,269 and 1,040,035 bytes, and latencies of
1,441 and 1,032 ms. No media body was requested. Host, immediate access, redirect, MIME, and
required-header evidence now pass.

The final authorized lifetime audit selected one candidate and observed the same successful 200,
no-redirect, `application/octet-stream`, 2,100,269-byte response immediately and after 240,000 ms.
The candidate maximum is reduced to the evidenced four-minute window. The executable tuple was
removed and the full deterministic gate passes. Independent production/commercial approval remains
a prerequisite for `internal` traffic, not an implementation debt in work item 10.2.

Implement or complete the selected adapter inside `packages/providers`.

1. Keep provider-native parsing, tokens, cookies, and response fields inside the adapter.
2. Add runtime-validated manifest capability and explicit region/priority settings.
3. Normalize every successful public format through `@tikdd/contracts`.
4. Map every production format to exactly one internal delivery candidate with a reviewed
   `hostPolicyId`; resolution-only results remain non-production.
5. Add bounded HTTP behavior, cancellation, timeout, response-size, MIME, redirect, and host checks.
6. Map every expected upstream failure to explicit terminal, fallback, and retry decisions.
7. Add sanitized fixtures for success, empty media, unsupported variant, removed/private content,
   challenge, rate limit, timeout, malformed markup/payload, and changed media host.

Exit gate:

- Candidate/result consistency, secret-redaction, SSRF, DNS, redirect, expiry, tamper, replay, and
  concurrency tests pass.
- No public contract or OpenAPI response contains downloadable URLs or provider-specific fields.
- The adapter still refuses production startup until its independent approval flag is present.

### Work item 10.3 — Two-provider routing and authorized X corpus

Status: complete on 2026-08-10. TwitterSaver is the deterministic X primary at priority 900 and
SSSTwitter the secondary at 800 in `global` and `canary-global`. Real-adapter contract tests cover
primary success, retryable sequential fallback, terminal stop, both unavailable, circuit-open skip,
concurrency-busy skip, attempt budget, and unreviewed-region denial. Synthetic X cases cover alias
canonicalization, query tracking, post variants, rejected unresolved short links, quoted/multi-video,
image-only, removed/private, and geographic outcomes. Four representative formats across both host
policies issue and redeem opaque tickets without following redirects or transferring media bytes.

The API now projects implementation provenance to generic `tikdd` / `api` values and removes
internal warnings before consumer delivery. Product Design review confirmed that primary and
fallback success continue to use the same ready state; visual scenario capture remains work item
10.4. Docker PostgreSQL and Redis were healthy. The standalone smoke script could not run because
the local API process was not active; deterministic route, delivery, API projection, and full
repository gates remain the 10.3 closure evidence.

Prove real sequential fallback without allowing the development mock into staging or production.

1. Define deterministic priorities for provider, platform `x`, and each reviewed region.
2. Add routing tests for primary success, primary retryable failure with secondary success, terminal
   stop, both providers unavailable, circuit-open skip, concurrency-busy skip, and attempt budget.
3. Expand the corpus with owner-authorized examples or synthetic fixtures for canonical posts,
   query variants, short links, quoted posts, multi-video posts, image-only posts, removed/private
   posts, and region-restricted responses.
4. Assert canonicalization and host-spoofing rules before provider execution.
5. Verify that every successful format can issue and redeem one redirect ticket without following
   or transferring media bytes in the test harness.

Exit gate:

- Forced failure of either real provider falls back only when the typed decision allows it.
- Terminal policy/content failures do not invite a second provider to bypass the restriction.
- The attempt ledger, canary measurements, diagnostics, API, Web, and logs remain sanitized.

### Work item 10.4 — Real-journey Product Design audit

Status: complete on 2026-08-10. Deterministic development-only application states exercise the
existing localized resolver without external requests. Desktop and 360-pixel mobile evidence covers
recognition, immediate submission, normal and slower success, retryable and terminal failures,
duplicate admission, delivery preparation, expiry, and regeneration. Four P0 flow/accessibility
gaps were closed and no P0 finding remains. See
[the work item 10.4 audit](design/work-item-10-4-audit.md).

Audit the implemented desktop and 360-pixel mobile journey using actual application states, not a
new visual concept. Capture and compare at least:

- recognized-link state;
- normal primary-provider success;
- slower fallback success;
- retryable temporary failure;
- terminal unavailable/private state;
- ready formats, delivery request, expired ticket regeneration, and duplicate submission.

P0 findings block rollout. The product must never expose provider names, fallback depth, circuit
state, internal warnings, or misleading claims about universal support, speed, quality, or privacy.
Fallback success may take longer, so progress copy and live-region announcements must remain useful
without inventing an exact completion time.

Exit gate:

- A first-time user completes the authorized X task on desktop and mobile without understanding the
  provider architecture.
- English and Simplified Chinese preserve equivalent order, action availability, error intent,
  keyboard focus, reduced motion, and 44-pixel touch targets.
- Any design change is limited to evidence-backed flow corrections and receives screenshot QA
  against the selected Signal Runway direction.

### Work item 10.5 — Internal calibration and staged rollout

Status: deterministic control-plane implementation complete on 2026-08-10; operational calibration
and staged rollout not started because independent production/commercial approval is not
established. No live provider request was made. See
[the implementation record](work-item-10-5-implementation.md).

1. Enable canary-only rules in isolated `canary-*` regions.
2. After the qualification gate, run internal traffic for at least three days and lock reviewed SLO
   thresholds from measured baselines rather than invented targets.
3. Add a rollout evaluator that can only hold, reduce, or deny existing grants. It cannot create a
   provider capability, widen a region, raise a percentage, or override an operator deny.
4. Promote one reviewed region through internal, 5%, 25%, 50%, and 100% cohorts. Each promotion is
   an audited operator decision after the required observation window.
5. Automatically return to the last healthy allocation or apply deny when locked error, latency,
   challenge, invalid-result, delivery, or stale-evidence thresholds are breached.
6. Keep a provider-wide emergency deny rehearsed and verify that workers observe it without a Web
   or API deployment.

Exit gate:

- Two real X providers have seven consecutive daily healthy evidence reviews across a minimum
  seven-day observation window.
- Resolution, delivery, fallback, challenge, and latency measures meet the locked pilot SLO with
  sufficient sample evidence.
- Automatic rollback, manual deny, stale telemetry, and recovery are proven and audited.

### Work item 10.6 — Integrated pilot closure

Status: deterministic gate implemented on 2026-08-10; external pilot closure remains pending. See
[the integrated gate record](work-item-10-6-implementation.md).

Add `pnpm verify:work-item-10` as the repeatable local/CI gate. It should compose deterministic
fixtures and Docker-backed controls without calling live providers in pull-request CI. Scheduled
authorized canaries remain an external operations gate.

The integrated gate covers:

- migrations and runtime configuration validation;
- both real provider manifests, fixtures, candidates, and error decisions;
- sequential routing, terminal stops, circuit/concurrency skips, and bounded attempts;
- ticket creation/redemption and delivery-host enforcement for both providers;
- rollout hold/rollback/deny behavior, stale evidence, and audit persistence;
- mock refusal in production and privacy/redaction assertions;
- Web/API multilingual state contracts and the full `pnpm check` gate.

Exit gate:

- CI and local Docker verification pass from a clean database/Redis state and clean up their data.
- The seven-day operational evidence is linked from the provider records without committing URLs,
  media, secrets, or raw provider responses.
- Work item 10 is marked complete only after both the deterministic gate and external pilot evidence
  pass.

## Recommended order and effort

| Order | Work item | Expected effort | Blocking dependency |
| --- | --- | --- | --- |
| 1 | 10.0 qualification and pilot-control ADR — complete | 1–2 days | Work item 9 baseline |
| 2 | 10.1 second-provider qualification — complete | 1–3 days | Authorization and reviewed regions |
| 3 | 10.2 production-complete adapter | 2–4 days | Selected provider evidence |
| 4 | 10.3 routing and X corpus | 1–2 days | Two deliverable adapters |
| 5 | 10.4 Product Design audit | 1–2 days | Real two-provider states |
| 6 | 10.5 calibration and rollout | 3 days plus 7-day observation | Approval and all preflight gates |
| 7 | 10.6 integrated closure | 1–2 days | Implementation and evidence |

Engineering effort is approximately 9–15 days plus the seven-day observation window. Qualification
may stop early if no second provider can meet the authorization, challenge, or delivery boundary;
that is a safe blocked outcome, not permission to weaken the boundary.

## Out of scope

- TikTok, YouTube, or broad catalog promotion;
- yt-dlp and FFmpeg runtime work;
- proxy or temporary-object delivery;
- user-supplied cookies or credentials;
- SEO platform pages, additional locales, advertising, or broad behavioral analytics;
- parallel provider fan-out or hedged requests.

## First executable step

The deterministic work item 10 gate is complete. Keep production traffic denied and the evidence
index `pending` until independent production/commercial approval exists. Only then may operations
start the real three-day internal calibration and subsequent seven-day staged observation; measured
health still cannot create or widen rollout permission.
