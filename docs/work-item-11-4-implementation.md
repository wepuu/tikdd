# Work item 11.4 implementation record

Status: complete on 2026-08-11. Pilot traffic remains disabled.

## Delivered boundary

- Migration `0010_pilot_evidence.sql` stores sanitized delivery outcomes, exact UTC daily evidence,
  aggregate late arrivals, calibration/review audit, export audit, and evaluator runs.
- Resolution attempts collapse to one task outcome before daily aggregation. Daily summaries keep
  counts and bounded histograms, never task IDs, submitted URLs, media URLs, cookies, or headers.
- Delivery redemption records stage/result taxonomy in the ticket transaction. Host-policy and DNS
  validation failures are distinguished without exposing candidate data.
- The Evidence service uses a Redis singleton lease, deterministically rebuilds current/previous
  UTC days, evaluates only locked policies, and can hold, reduce, deny, or mark recovery eligible.
  It cannot increase either a Guard cap or an operator allocation.
- PostgreSQL is authoritative. Workers consume revisioned expiring Redis Guard snapshots and fail
  closed on missing, stale, incompatible, or zero-cap state.
- Independent-token diagnostics and export expose only aggregate scope, freshness, sufficiency,
  policy, Guard, evaluator, and daily evidence. They are `no-store`, non-indexable, and intentionally
  absent from public OpenAPI.
- Bounded cleanup covers outcomes, summaries, late counters, proposals, reviews, audits, and runs.

## Product Design review

The diagnostics information architecture follows scope → freshness → sufficiency → policy → Guard
→ evaluator → days, with deny/failure state before supporting detail. No consumer-facing admin UI
was added. The API-only review recorded zero P0/P1 findings; visual and accessibility claims remain
out of scope until a rendered operator interface exists. See
[the diagnostics IA review](design/work-item-11-4-diagnostics-ia.md).

## Verification

`pnpm verify:work-item-11` passed all six stages:

1. migrations through `0010`;
2. 29 focused evidence, privacy, Guard, API, delivery, and cleanup tests;
3. Docker-backed UTC replay, idempotence, privacy, and restrictive evaluation;
4. bounded cleanup, cascade, repeat-run, and lease-contention checks;
5. zero verification residue;
6. repository lint, type checks, 192 tests in 41 files, and production builds.

The gate made no live provider request and confirmed that public OpenAPI did not change.
