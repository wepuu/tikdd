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

`provider_attempts` records task, provider, platform, kind, static priority, route score, status,
failure class, retry/fallback decisions, and timing. Raw URLs, provider payloads, cookies, tokens, and
direct download links are excluded.

The next health implementation will aggregate time-windowed attempts by provider/platform/region,
with minimum sample sizes and hysteresis. Circuit breakers must distinguish schema failures,
challenges, timeouts, and platform-wide content failures; one broken extractor must not disable an
otherwise healthy multi-platform provider.

## Operational rules

- No unbounded loops and no automatic parallel fan-out.
- No fallback intended to bypass private, paid, authenticated, DRM, or permission restrictions.
- Feature flags can disable one provider/platform/region combination without redeploying Web/API.
- Provider response fixtures and logs are sanitized before persistence.
- Priority changes are configuration changes with review, audit history, and rollback.

