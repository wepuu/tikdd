# Authorized canary scheduling and diagnostics

Work item 9.5 turns the reviewed canary corpus into an independently scheduled operational probe.
It is not reachable from the public API and cannot be activated by an HTTP header or query value.

## Safety gates

`@tikdd/canary` refuses to start unless all of these are true:

- `TIKDD_CANARY_AUTHORIZED=true` after reviewing the authorization record;
- runtime rollout, circuit health, and distributed admission controls are enabled;
- the scheduler uses an isolated `canary-*` region;
- a current, audited rollout rule explicitly grants the provider/platform/canary-region tuple.

Fleet and provider deny rules still win. The router also applies manifest capability, circuit state,
sequential fallback, route deadlines, and provider concurrency. No mock provider participates.
The Redis key `tikdd:canary:v1:<deployment>:lease` allows one scheduler per deployment.

## Configuration

```dotenv
TIKDD_CANARY_AUTHORIZED=false
CANARY_DEPLOYMENT=local
CANARY_REGION=canary-global
CANARY_INTERVAL_MS=900000
CANARY_RUN_TIMEOUT_MS=120000
CANARY_LEASE_TTL_MS=130000
CANARY_MEASUREMENT_RETENTION_MS=2592000000
```

The existing rollout cohort key, maximum stale interval, health policy, and admission policy are
reused. Production requires an explicit deployment namespace. Provision exact canary-region grants
through the audited rollout operator path before starting the scheduler.

```sh
pnpm canary:run
pnpm canary:start
pnpm verify:canary
```

The legacy `pnpm canary:providers` command remains a deliberately manual adapter feasibility tool.
Only `@tikdd/canary` is the scheduled, rollout-controlled path.

## Stored and exposed data

Migration `0008` stores only run/canary/provider/platform/region identifiers, success or normalized
failure class, latency, format count, candidate lifetime, attempt count, fallback depth, timestamps,
and expiry. It never stores the configured URL, canonical URL, media metadata, provider response,
candidate URL, headers, cookies, or content. Work item 9.4 removes expired measurements in bounded
batches.

The authenticated `GET /internal/v1/provider-health` response now combines:

- manifest enablement and static priority;
- rollout revision and sanitized rule metadata;
- circuit state and categorized recent attempt failures;
- aggregate fallback depth;
- expiring canary health summaries.

The route remains absent when `PROVIDER_DIAGNOSTICS_TOKEN` is unset, uses `no-store`/`noindex`, and
is excluded from public OpenAPI and Web. Keep it behind a private gateway as well as the bearer
credential.

## Verification and pause

`pnpm verify:canary` uses Docker PostgreSQL and Redis without calling a real provider. It proves
sanitized persistence, health aggregation, singleton lease ownership, and expiry cleanup. Unit tests
prove the runner does not execute without the lease and that diagnostics contain no private fields.

To pause network probes, stop the canary deployment or apply an emergency deny rule. Historical
measurements remain only until their configured expiry.
