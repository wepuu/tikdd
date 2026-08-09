# Work item 9 integrated verification gate

Work item 9.6 closes the ADR-0007 implementation with one repeatable local/CI command:

```sh
pnpm verify:work-item-9
```

`DATABASE_URL` and `REDIS_URL` must point to isolated PostgreSQL and Redis services. The command does
not start containers, modify rollout rules outside verification-scoped IDs, or call real providers.
Each verifier removes its PostgreSQL rows and TikDD-owned Redis keys in `finally`.

## Verification matrix

| Stage | Boundary proved |
| --- | --- |
| Migrations | Migrations `0001`–`0008` remain repeatable |
| Rollout | Audited enable, emergency deny, ambiguous-rule rollback, stale snapshot denial, and dual-store fail-closed |
| Task admission | Concurrent idempotent winner/replay, conflicting key, capability-safe duplicate, and terminal release |
| Redis admission | Client/global rate ceilings, active-task ceilings, shared idempotent permits, and owner-scoped provider concurrency |
| Routing health | Provider failure opens only its tuple, one half-open probe wins, and success closes the circuit |
| Cleanup | No-write count, singleton contention, bounded cascade, fresh-row preservation, and zero-change repeat |
| Canary | Metadata-only persistence/aggregation, singleton lease, and expiry cleanup without provider network calls |
| Repository gate | Lint, all TypeScript projects, all tests including failure injection/privacy, and production builds |

The orchestrator stops on the first failed stage and emits only stage name, status, and duration. It
never includes task IDs, URLs, digests, media metadata, provider payloads, candidates, or secrets in
its own result envelope.

## Recorded closure

The local Docker gate passed on 2026-08-09 with eight stages in approximately 103 seconds. The final
repository stage passed 27 test files and 106 tests plus every production build. GitHub CI now
provisions PostgreSQL 17 and Redis 7.4 services and runs this same gate instead of a shallower
`pnpm check`-only job.

This closes implementation verification, not pilot policy calibration. Production provider grants,
thresholds, canary schedules, and public platform claims still require reviewed operational evidence.
