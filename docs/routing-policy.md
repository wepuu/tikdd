# Provider routing policy

TikDD routes within a platform-specific capability graph. Providers declare capability; the router
does not ask every adapter whether it supports a URL at runtime.

## Provider manifest

```ts
const manifest = {
  id: "example-site",
  displayName: "Example Site",
  kind: "site-adapter",
  enabled: false,
  regions: ["global"],
  timeoutMs: 12_000,
  costWeight: 15,
  platforms: [
    { platform: "instagram", priority: 900 },
    { platform: "tiktok", priority: 700 },
    { platform: "youtube", priority: 300 }
  ]
};
```

Manifests are runtime-validated at worker startup. Provider IDs and platform entries must be unique.
Priority is platform-specific because an adapter can be excellent for one platform and weak for
another.

## Eligibility and ordering

A candidate is eligible when:

1. its manifest is enabled;
2. it declares the detected platform;
3. it runs in `*` or the worker's region;
4. its provider/platform/region circuit is not open;
5. the route still has time and attempt budget.

Current score:

```text
platform priority × 1000
+ bounded success-rate bonus
- bounded p95 latency penalty
- cost weight
```

Static priority dominates, making business intent and adapter quality deterministic. Health and cost
can reorder providers within a priority neighborhood without silently overriding a large explicit
preference. Provider ID is the final tie-breaker so tests and operations are reproducible.

The default maximum is four sequential provider calls inside a 30-second route budget. Each
provider also has its own shorter timeout. The first valid normalized result wins.

## Error decisions

Adapters throw a typed `ProviderError(failureCode, retryable, fallbackAllowed)`. The router records
the attempt before deciding what happens next.

- `provider_timeout`, `provider_rate_limited`, `provider_challenge`, `provider_schema_changed`,
  `provider_unavailable`, `invalid_result`, and transient internal errors normally allow fallback.
- `unsupported_url` can allow fallback because another provider may support that URL variant.
- `content_not_found`, `content_private`, `authentication_required`, `payment_required`,
  `drm_protected`, and policy-defined geographic restrictions are terminal by default.
- A terminal error also becomes an unrecoverable queue job so BullMQ does not rerun the complete
  provider chain.

Fallback and queue retry are separate budgets. Fallback handles provider diversity within one job;
queue retry handles a short-lived system/upstream outage after every eligible provider has failed.

## Attempt ledger and health

`provider_attempts` records task, provider, platform, actual worker region, kind, static priority,
route score, status, failure class, retry/fallback decisions, and timing. Raw URLs, provider
payloads, cookies, tokens, and direct download links are excluded.

ADR-0006 defines each circuit by provider, platform, and the actual worker region. The attempt ledger
records that region, and the routing health boundary receives the complete tuple. The health worker
selects the latest observation per task and exact tuple inside a time window, so queue retries of one
task cannot manufacture the minimum sample size needed to open a circuit.

Schema/integrity, access-friction, and availability failures use separate versioned thresholds.
Missing, private, authenticated, paid, DRM, geographic-policy, and unsupported-URL outcomes remain
diagnostic but are neutral to provider circuit health. Opening and recovery use hysteresis. After an
open cooldown, an atomic Redis lease permits only one bounded half-open probe; only normalized
successes close the circuit.

PostgreSQL attempts are the durable facts. Revisioned Redis snapshots and probe leases expire and can
be rebuilt. Snapshot publication uses compare-and-set so an aggregator cannot overwrite a concurrent
probe transition. If no usable health snapshot is available, the router uses neutral health and
static manifest order while preserving all existing sequential fallback, attempt, timeout, and
terminal-error boundaries.
See [ADR-0006](architecture/adr/0006-provider-health-and-circuits.md).

## Operational rules

- No unbounded loops and no automatic parallel fan-out.
- No fallback intended to bypass private, paid, authenticated, DRM, or permission restrictions.
- ADR-0007 requires versioned runtime rules to disable one provider/platform/region combination
  without redeploying Web/API. Until work item 9.1 lands, process-level enablement is not sufficient
  for production rollout.
- Provider response fixtures and logs are sanitized before persistence.
- Priority changes are configuration changes with review, audit history, and rollback.
