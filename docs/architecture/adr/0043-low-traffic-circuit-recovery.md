# ADR-0043: Low-traffic circuit recovery

- Status: accepted
- Date: 2026-09-25
- Scope: production Provider health aggregation and Admin route visibility

## Decision

The production Provider health policy uses one successful half-open probe to close a circuit:
`recoverySuccesses=1`. The half-open lease remains single-use, cooldowns remain bounded, and a
Provider fault reopens the same provider/platform/region key. The policy is versioned as
`production-low-traffic-v2` so a deployment cannot silently retain the previous recovery rule.

## Context

TikDD has low request volume. Requiring two successful probes can leave a healthy route in
`half-open` after the first real user task, even though routing is sequential and each task is
already bounded to one Provider attempt. A single successful, newly observed half-open request is
enough evidence to close the circuit for this small production deployment. It is not a synthetic
probe and it does not authorize additional traffic.

## Guardrails

- Only a successful observation after the half-open transition counts; cached results and stale
  snapshots are not recovery evidence.
- One half-open probe lease is granted at a time. A failure reopens with the existing bounded
  cooldown; the policy does not weaken failure thresholds or Provider timeouts.
- Route fallback remains sequential and bounded. No automatic Provider retry, manual Redis reset,
  calibration run, or synthetic Provider request is introduced.
- Admin exposes the sanitized recovery count and makes a zero-count half-open route explicit as
  “waiting for a natural recovery probe”.

## Consequences

The next distinct natural request can close a recovered route without an operator reset. Low traffic
may still leave a route half-open until that request arrives; this is intentional. Release checks
must verify configuration and service health only, not manufacture Provider traffic. A future higher
volume deployment may supersede this ADR with a policy based on measured sample volume.
