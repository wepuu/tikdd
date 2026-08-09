# Provider rollout operations

Work item 9.1 implements the runtime provider authorization boundary defined by
[ADR-0007](architecture/adr/0007-rollout-admission-and-abuse-controls.md). Rollout permission is
independent from provider health: a route needs both an affirmative rollout decision and circuit
permission.

## Storage and propagation

- PostgreSQL tables `provider_rollout_rules` and `provider_rollout_rule_audit` are the durable source
  and append-only change history.
- Redis key `tikdd:rollout:v1:snapshot` is an expiring compiled snapshot. Publication rejects an
  older global audit revision and notifies `tikdd:rollout:v1:changed`.
- Each worker refreshes from PostgreSQL at least every five seconds. Route decisions read Redis and
  fall back to a fresh durable snapshot. They never roll an in-process revision backward.
- Missing or stale production authorization denies new provider attempts. Circuit health retains
  its separate fail-soft behavior.

## Worker configuration

Set these deployment secrets and settings before enabling a production provider:

```dotenv
PROVIDER_ROLLOUT_ENABLED=true
PROVIDER_ROLLOUT_COHORT_KEY_BASE64URL=<secret with at least 32 random bytes>
PROVIDER_ROLLOUT_REFRESH_MS=5000
PROVIDER_ROLLOUT_SNAPSHOT_TTL_MS=30000
PROVIDER_ROLLOUT_MAX_STALE_MS=15000
```

The cohort key belongs in the deployment secret manager, must be identical across workers in the
same rollout domain, and must never be logged. `PROVIDER_ROLLOUT_DEVELOPMENT_BYPASS` is rejected in
production. Without the bypass, local real providers also require rollout rules; the development
mock remains available only outside production.

Process-level provider enablement and terms approval remain hard prerequisites. A rollout rule can
only reduce the provider manifest's platform, region, timeout, and production-safety boundaries.

## Apply a reviewed rule

The operator command uses direct database/Redis credentials and is intentionally not part of public
OpenAPI or the consumer Web application. Set an opaque operator identifier and a concise change
reason. Do not place URLs, task IDs, user data, or credentials in either field.

Initial X/global authorization at 5%:

```powershell
$env:ROLLOUT_RULE_JSON='{"id":"twittersaver-x-global","providerId":"twittersaver","platform":"x","region":"global","enabled":true,"allocationBps":500,"activatesAt":"2026-08-09T13:00:00.000Z","expiresAt":null}'
$env:ROLLOUT_OPERATOR_ID='operator.example'
$env:ROLLOUT_CHANGE_REASON='Begin reviewed X global pilot at five percent.'
Remove-Item Env:ROLLOUT_EXPECTED_REVISION -ErrorAction SilentlyContinue
pnpm rollout:apply
```

The command returns only the rule ID, per-rule revision, and global snapshot revision. Updating an
existing rule requires optimistic concurrency:

```powershell
$env:ROLLOUT_EXPECTED_REVISION='1'
$env:ROLLOUT_RULE_JSON='{"id":"twittersaver-x-global","providerId":"twittersaver","platform":"x","region":"global","enabled":true,"allocationBps":2500,"activatesAt":"2026-08-09T13:00:00.000Z","expiresAt":null}'
$env:ROLLOUT_CHANGE_REASON='Advance reviewed X global pilot to twenty-five percent.'
pnpm rollout:apply
```

A stale expected revision fails without overwriting another operator's change.

## Emergency deny and recovery

Create a provider-wide deny to stop every currently authorized platform and region for that
provider. Matching deny rules always win over more specific grants:

```powershell
$env:ROLLOUT_RULE_JSON='{"id":"twittersaver-emergency-stop","providerId":"twittersaver","platform":"*","region":"*","enabled":false,"allocationBps":0,"activatesAt":"2026-08-09T13:30:00.000Z","expiresAt":null}'
$env:ROLLOUT_OPERATOR_ID='operator.example'
$env:ROLLOUT_CHANGE_REASON='Emergency stop after reviewed incident trigger.'
Remove-Item Env:ROLLOUT_EXPECTED_REVISION -ErrorAction SilentlyContinue
pnpm rollout:apply
```

After the incident is resolved, expire that deny with its expected revision and a reviewed expiry
after the original activation time. Do not turn a provider-wide deny into a broad allow. Existing
specific grants then resume according to their allocations and circuit states.

## Rule evaluation

1. Inactive and expired rules are ignored.
2. Any matching fleet/provider/platform/region deny rejects the provider.
3. Otherwise the most specific matching grant supplies the allocation.
4. The cohort bucket is a keyed HMAC of stable rule ID and opaque task ID; no URL or network address
   participates.
5. No matching current grant denies production access.

The snapshot validator rejects duplicate selectors and overlapping, equally specific grants that
could produce ambiguous authorization.

## Verification

With the local PostgreSQL and Redis containers healthy:

```sh
pnpm db:migrate
pnpm verify:rollout-control
pnpm check
```

The integration verification creates isolated rule IDs, proves enable and no-deploy emergency deny,
checks both audit revisions, and restores the previous Redis snapshot before removing its database
records.
