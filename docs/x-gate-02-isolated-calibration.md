# X-GATE-02 — Isolated calibration runtime

## Outcome

The repository now contains a fail-closed, default-off runtime lane for the exact SSSTwitter/X/NL
internal calibration scope selected by ADR-0017. This is implementation readiness only. It does
not authorize deployment, profile startup, calibration requests, Provider traffic, Admin startup,
pilot rollout, publication, or indexing.

## Boundaries

- Public API and Worker explicitly use `resolve`.
- Calibration API and Worker use `resolve-internal-ssstwitter-x-nl`.
- The calibration API is published only on loopback port 3410 and is not routed by Nginx.
- Calibration services exist only in the `calibration` Compose profile and use `restart: "no"`.
- SSSTwitter, its terms/audit assertions, and rollout all default to false in that profile.
- The calibration Worker has concurrency one and is the only calibration service with Provider
  egress.
- API and Worker startup each require a current role- and queue-bound signed attestation.

## Authorization sequence for a later work item

After a separate owner approval, an operator must supply current sanitized operational signals,
explicitly enable the four calibration gates, remove any expired role attestation files, run both
role-specific preflight services, and only then start the calibration API and Worker. Calibration
must be stopped and the gates returned to false at the end of the approved window.

No part of that operational sequence was executed as part of X-GATE-02 implementation.

## Verification

Run:

```text
pnpm verify:x-gate-02
pnpm check
docker compose --env-file <production-env> -f compose.production.yml --profile calibration config --quiet
```

The Docker Compose command validates expansion only; it must not use `up`, `run`, or `start` during
repository review.
