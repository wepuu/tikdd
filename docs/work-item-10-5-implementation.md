# Work item 10.5 implementation record

- Date: 2026-08-10
- Engineering state: deterministic control plane implemented
- Operational state: not started; independent production/commercial approval is not established
- Live provider requests performed: none

## Implemented

- Runtime-validated pilot policy requires three complete calibration days before lock.
- Evidence model is exact provider/platform/region and contains only bounded aggregate measures.
- Automatic evaluator supports `hold`, `reduce`, `deny`, and `eligible_for_review`.
- Evaluation and persistence independently prevent automatic cap increases.
- Stale evidence reduces to the reviewed rollback allocation or denies according to locked policy.
- Absolute-stop evidence denies without a statistical sample minimum.
- PostgreSQL migration `0009` adds versioned policy, current guard, append-only guard audit, and
  qualification review state without public or media identifiers.
- Worker can require a fresh exact-tuple pilot guard in addition to the existing deny-first
  operator snapshot. Missing/stale/expired state fails closed.
- Existing provider-wide deny precedence and no-deploy refresh remain unchanged.
- No public OpenAPI, Web copy, SEO page, or task model exposes qualification, provider health,
  allocation, evidence, or guard state.

## Verification completed

- Policies shorter than three complete calibration days are rejected.
- Insufficient samples hold rather than promote.
- Threshold breaches reduce to a previously reviewed allocation.
- Absolute stops deny at zero allocation.
- Healthy recovery never raises a reduced cap and requires operator review.
- Operator deny wins over a guard and a required missing/stale guard fails closed.
- Migration privacy assertions reject task, submitted/canonical URL, candidate, cookie, and header
  fields.

## Intentionally pending operational gates

No production/commercial approval reference exists for the two X routes, so TikDD must not start
internal or public traffic. The following are real-time evidence requirements and cannot be
substituted with fixtures or accelerated timestamps:

1. run at least three complete consecutive internal days in one reviewed region;
2. lock measured SLO thresholds with sufficient distinct samples;
3. promote through internal, 5%, 25%, 50%, and 100% only by audited operator decisions;
4. record seven consecutive healthy daily reviews across at least seven external observation days;
5. rehearse rollback, stale telemetry, recovery review, and provider-wide emergency deny against
   the approved deployment.

Until those gates pass, work item 10.5 is implementation-complete but operationally blocked, and
work item 10 cannot close.
