# Provider health operations

Dynamic provider health is an opt-in internal control-plane feature. It never changes the public
resolve contract and must not be enabled with an unreviewed policy.

## Runtime configuration

Set `PROVIDER_HEALTH_ENABLED=true` on resolver workers and provide a versioned policy in
`PROVIDER_HEALTH_POLICY_JSON`. The worker refuses to enable health routing without a valid policy.

```json
{
  "version": "pilot-v1",
  "observationWindowMs": 300000,
  "minimumDistinctTasks": 20,
  "thresholds": {
    "integrity": { "minimumFailures": 5, "openRate": 0.25 },
    "accessFriction": { "minimumFailures": 10, "openRate": 0.5 },
    "availability": { "minimumFailures": 10, "openRate": 0.5 }
  },
  "baseCooldownMs": 60000,
  "maximumCooldownMs": 900000,
  "recoverySuccesses": 2,
  "snapshotTtlMs": 600000,
  "probeLeaseMs": 30000,
  "aggregationLeaseMs": 15000
}
```

The example is a configuration shape, not an approved production threshold set. Replace its values
with reviewed pilot measurements and increment `version` for every policy change. The refresh
interval is controlled separately by `PROVIDER_HEALTH_REFRESH_MS` and must be at least one second.

## State and failure behavior

- PostgreSQL attempts are the durable source. The health query selects the latest attempt per task
  and provider/platform/region key so queue retries do not manufacture independent samples.
- Redis snapshots are revisioned, expire, and use compare-and-set publication. A stale aggregator
  cannot overwrite a concurrent half-open transition.
- Open circuits remain isolated to one provider/platform/region key.
- After cooldown, Redis grants one half-open probe lease. Normalized success closes according to the
  configured recovery count; a provider fault reopens with bounded cooldown growth.
- Missing or unavailable Redis state degrades to neutral static routing. Existing route deadlines,
  provider timeouts, attempt budgets, and terminal-error rules still apply.

## Internal diagnostics

Set `PROVIDER_DIAGNOSTICS_TOKEN` to an independent secret of at least 32 characters to register:

```text
GET /internal/v1/provider-health
Authorization: Bearer <operator-secret>
```

Without the secret, the route is not registered and returns 404. Incorrect credentials return 401.
Responses are `no-store` and contain only provider ID, platform, region, state, sanitized categorized
counts, sample sufficiency, latency, transition times, policy version, and revision. They never
contain submitted URLs, media metadata, raw provider payloads, delivery candidates, or user IDs.

The route is an operator API, not a consumer feature. Keep it behind the deployment's private
network or gateway in addition to the bearer credential. Do not add it to public OpenAPI or the Web
application.

## Verification

Run unit and production-build checks:

```sh
pnpm check
```

With the local PostgreSQL and Redis containers available, apply migrations and run the real state
transition verification:

```sh
pnpm db:migrate
pnpm verify:routing-health
```

Local Docker Compose publishes Redis on host port `16379` by default because Docker Desktop and
Hyper-V can reserve the traditional `6379` range on Windows. Override `REDIS_HOST_PORT` and keep
`REDIS_URL` aligned when another host port is required; Redis still listens on `6379` inside the
container.

The verification creates isolated temporary task and circuit keys, proves PostgreSQL observation
reads, open-state publication, single half-open lease, and recovery to closed, then removes its test
records and Redis keys.
