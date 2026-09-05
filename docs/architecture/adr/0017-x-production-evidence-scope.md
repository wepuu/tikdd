# ADR-0017: Single-tuple first X production evidence gate

- Status: Accepted
- Date: 2026-09-05
- Scope: first X production evidence checkpoint
- Extends: ADR-0008, ADR-0009, ADR-0014, and ADR-0016

## Context

The original checked-in X pilot evidence index named both TwitterSaver and SSSTwitter. Later
production work established a complete technical resolve and Delivery path through SSSTwitter in
the concrete `nl` Worker region, while recurring scheduled proof is intentionally restricted to
SSSTwitter/X in `canary-global`. Requiring two Providers in one closure index now makes the first X
production checkpoint depend on a second Provider even though evidence, qualification, rollout,
and Delivery decisions are defined for exact tuples.

The X Production Evidence Gate must therefore identify one reviewed production tuple. It must not
combine regions or observation classes, treat a scheduled Canary as production evidence, or enable
traffic merely because the repository scope has been selected.

## Decision

The first X production evidence checkpoint covers exactly:

```text
provider: ssstwitter
platform: x
actual worker region: nl
external observation class: public
```

The three-day calibration that precedes the external pilot uses the same Provider/platform/region
tuple with observation class `internal`. It remains a separate evidence window and must produce
three consecutive sealed UTC days before a numeric pilot policy can be proposed and locked.

`config/x-pilot-evidence.json` advances to schema version 2 and records one exact scope instead of
a Provider array. Its seven daily reviews describe only the post-grant `public` observation window
for SSSTwitter/X/NL. A `complete` status is valid only after seven consecutive healthy, sufficient
reviews for that scope and the remaining owner/browser and reconciliation gates have been recorded.

The checked-in internal preflight plan is narrowed to the same single Provider. A future internal
runtime must enable exactly SSSTwitter for its short-lived attestation to match; the preflight must
not require or permit TwitterSaver merely because it was present in the historical two-Provider
plan.

TwitterSaver remains a disabled X Provider candidate with its own reviewed Manifest, authorization,
and Delivery boundary. It is not removed from routing code or Provider records, but its calibration
and qualification are independent and do not block or satisfy this first checkpoint. Adding it to
a later production gate requires a separate exact-scope decision and evidence history.

The recurring `ssstwitter/x/canary-global` measurement remains supporting technical-health evidence
only. It cannot count toward SSSTwitter/X/NL internal calibration, public pilot sample sufficiency,
or a production allocation decision.

Selecting this scope grants no permission to contact SSSTwitter, start Admin, enable the Worker
Provider, create a rollout rule, or publish/index X. Those actions retain their existing explicit,
bounded authorization requirements. Only an owner rollout action can create or increase traffic.

## Consequences

- The checked-in evidence index and its deterministic verifier now fail closed unless the exact
  SSSTwitter/X/NL/public scope is present.
- The internal preflight plan now fails closed unless its enabled Provider set is exactly
  SSSTwitter in X/NL.
- Evidence from TwitterSaver, `canary-global`, another Worker region, or another observation class
  cannot be inserted into this index to complete the gate.
- The first X path can be assessed without manufacturing a second live Provider program.
- Sequential fallback and multi-Provider capability remain supported; this decision changes only
  the first production evidence checkpoint.
- X platform lifecycle promotion, public presentation, and indexability remain separate reviewed
  product decisions after the evidence gate closes.

## Rejected alternatives

### Keep one mandatory two-Provider closure index

Rejected because it combines independent exact-tuple qualifications and could pressure the project
to start an unnecessary Provider integration merely to close the first production checkpoint.

### Count `canary-global` as NL calibration evidence

Rejected because ADR-0009 fixes evidence to the actual Worker region and observation class. Canary
volume cannot satisfy internal or public distinct-task samples.

### Mark the selected scope as authorized by committing it

Rejected because version-controlled scope is not production permission. Runtime flags, approval,
qualification, rollout, guard, circuit, and Delivery gates remain independently authoritative.
