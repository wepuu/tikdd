# Work item 10.6 integrated pilot gate

- Date: 2026-08-10
- Deterministic gate: implemented
- Latest local result: 12/12 stages passed in 172,941 ms
- Live provider traffic: forbidden by the gate
- External pilot evidence: pending

## Command

```sh
pnpm verify:work-item-10
```

The command requires `DATABASE_URL` and `REDIS_URL`. Pull-request CI supplies fresh PostgreSQL and
Redis services. Local runs use the Docker Desktop services documented in the repository.

## Deterministic stages

1. Apply all database migrations.
2. Validate the sanitized external-evidence index without requiring pending evidence to exist.
3. Run the explicit provider, routing, delivery, activation, rollout, platform, API, and multilingual
   Web contract suite.
4. Verify transactional delivery candidate parity, opaque one-use tickets, and rollback.
5. Verify operator rollout grants, provider-wide deny, stale authorization, and audit history.
6. Verify pilot reduction, deny, recovery hold, bounded operator review, and audit persistence.
7. Verify admission, distributed concurrency, circuit recovery, metadata-only canary persistence,
   retention, and bounded cleanup.
8. Assert that PostgreSQL and Redis retain no `verification-*` rows or keys.
9. Run the full lint, typecheck, test, and production-build gate.

Every Docker-backed verifier creates isolated data and removes it in a `finally` boundary. The
orchestrator clears upper- and lower-case proxy variables, disables every provider process flag,
forces live-canary authorization off, and never invokes `canary:providers`, `canary:run`, or a
provider adapter against the network.

## Independent operational closure

[`config/x-pilot-evidence.json`](../config/x-pilot-evidence.json) is deliberately `pending`. The
deterministic gate may pass in that state, but work item 10 cannot close until independent
production/commercial approval permits the real three-day calibration and the file contains seven
consecutive, healthy, sample-sufficient daily review entries with opaque evidence references.

The evidence validator rejects URL-like values and keys associated with tasks, candidates, media,
headers, cookies, tokens, secrets, payloads, and network addresses. Provider records link only to
this sanitized index; raw evidence remains outside the repository.
