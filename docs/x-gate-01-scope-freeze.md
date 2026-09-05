# X-GATE-01 — SSSTwitter/X/NL scope freeze

Status: implemented and locally verified on 2026-09-05; calibration is not authorized or started.

## Outcome

ADR-0017 selects exactly SSSTwitter/X/NL for the first X production evidence checkpoint. The
preceding calibration must use `internal` observations for that tuple, and the seven-day external
index accepts only `public` observations for the same tuple.

TwitterSaver remains a disabled independent candidate. It is no longer required by the current
internal preflight or first X closure index. Scheduled `ssstwitter/x/canary-global` measurements
remain technical-health evidence and cannot count as NL calibration or public pilot samples.

## Machine-enforced changes

- `config/x-internal-preflight.json` requires exactly the SSSTwitter Provider and page Host.
- `config/x-pilot-evidence.json` schema version 2 records the exact SSSTwitter/X/NL/public scope.
- The preflight verifier asserts the single Provider scope and still fails closed without matching
  live runtime signals.
- The evidence verifier rejects a different Provider, platform, region, observation class, schema,
  or incomplete seven-day closure.

## Verification

- `pnpm verify:preflight`
- `pnpm verify:work-item-10:evidence`
- repository lint and all workspace type checks
- 80 test files and 418 tests
- all workspace production builds

## Remaining authorization gate

Before any production calibration begins, the owner must still provide one bounded authorization
for `ssstwitter/x/nl/internal` that names the approved owner/team cohort, exact test input, task
cadence, maximum concurrency, start time, stop time, and opaque emergency-stop owner. A later public
pilot requires its own allocation, cohort, expiry, concurrency, rollback, and observation-window
authorization.

This work created no Provider request, rollout rule, Admin session, production deployment, platform
promotion, publication, or indexing change.
