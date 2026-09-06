# ADR-0023: Separate public release checks from internal calibration preflight

Status: Accepted — 2026-09-06

## Context

The production release runner always executed the isolated X calibration preflight. That preflight
requires an internal-only queue, role-bound runtime, current three-day authorization window and
fresh calibration evidence. ADR-0020 made those calendar-length calibration controls optional for
the public MVP, but the runner still expected a `ready` calibration result whenever any public
Provider rollout was enabled. As a result, a healthy public release with the existing X Beta route
could update all core containers and then fail final signing for unrelated calibration blockers.

## Decision

- `TIKDD_INTERNAL_PREFLIGHT_REQUIRED` explicitly controls the isolated calibration preflight and
  defaults to `false`.
- Public MVP releases skip that one-shot preflight and print the skip decision. They still require
  immutable images, backup verification, migration, staged shared-host checks, service health,
  rollout rules and Provider process gates.
- An authorized calibration deployment sets the flag to `true`. Only then are complete operational
  signals mandatory, and the existing rollout-aware `ready`/`blocked` decision remains fail-closed.
- The release runner does not infer calibration authorization from the public
  `PROVIDER_ROLLOUT_ENABLED` switch.

## Consequences

Public Provider traffic no longer accidentally reintroduces the superseded three-day calibration
gate. Calibration evidence remains truthful and available when deliberately requested. A malformed
control flag or a failed enabled preflight still stops deployment.
