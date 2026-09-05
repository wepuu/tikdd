# ADR-0019: Bounded calibration operations

- Status: Accepted
- Date: 2026-09-05
- Extends: ADR-0017 and ADR-0018

## Context

The isolated calibration profile is default-off, but direct Compose commands do not prove that an
operator is using the approved release, source, cohort, qualification revision, time window, task
budget, cadence, or stop owner. A forgotten stop command could also leave a Provider-enabled
process alive beyond its authorization.

## Decision

Calibration operations use one strict external authorization JSON document. It covers exactly
`ssstwitter/x/nl/internal`, one SHA-256 source digest, one release and qualification revision, one
opaque cohort, exactly three UTC days, a bounded task count and cadence, concurrency one, and one
opaque emergency-stop owner. No active authorization is checked into the repository.

`calibration:preflight` evaluates a fresh sanitized operational snapshot and fails closed for stale
WI17 services, the wrong Canary/circuit/qualification state, public rollout or Provider flags,
queue backlog, an already-running profile, or unavailable emergency deny. `calibration:start`
repeats that preflight, issues separate role-bound attestations, and starts only the isolated API
and Worker. Mutating commands require the current shell to set
`TIKDD_CALIBRATION_EXECUTE=<authorizationId>`.

The authorization identity and exact UTC window are part of the API and Worker runtime digest.
Both processes reject startup outside that window and schedule their own shutdown at its end. The
API also refuses new tasks after expiry. Submissions enter the private API over container stdin;
the source URL is never a command argument, environment variable, state field, or log field. State
stores only opaque task IDs and digests. An authorization-scoped lock serializes start, submit, and
stop. Stop targets only the two calibration services and deletes only their two attestations.

## Consequences

- Repository deployment alone still cannot enable Provider traffic.
- An operator must obtain and protect a separate active authorization and a fresh authoritative
  sanitized snapshot before starting a window.
- Restarting an old container or replaying an attestation outside the authorized window fails.
- The tooling does not create a public rollout grant, policy lock, Admin session, or platform/SEO
  promotion.
- Production execution and each actual source remain separate owner decisions.
