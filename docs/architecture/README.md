# TikDD architecture

TikDD is a multilingual public-media resolution system. Platform recognition, provider selection,
media delivery, and the SEO website are separate concerns. The platform catalog can grow without a
public contract release, while each provider independently declares which platform families it can
handle.

## System view

```mermaid
flowchart LR
    Web["Localized Web<br/>SSR and static content"] --> API["Control API"]
    API --> Catalog["Platform catalog<br/>host recognition and status"]
    API --> Admission["Admission controls<br/>deny, cohort, quota, dedupe"]
    Admission --> DB[(PostgreSQL)]
    Admission --> Queue[(Redis and BullMQ)]
    DB --> Rollout["Versioned rollout policy<br/>and audit"]
    Rollout --> Admission

    Queue --> Worker["Resolver worker"]
    Worker --> Router["Capability router<br/>eligibility, score, fallback budget"]
    Rollout --> Router
    Router --> Registry["Provider manifests<br/>platform, region, priority, limits"]
    Registry --> AdapterA["Third-party site adapter A"]
    Registry --> AdapterB["Third-party API B"]
    Registry --> YtDlp["Isolated yt-dlp runner"]
    AdapterA --> Normalize["Unified result validation"]
    AdapterB --> Normalize
    YtDlp --> Normalize
    Normalize --> DB

    DB --> Health["Attempt-ledger aggregation"]
    Health --> Circuit[("Redis circuit snapshots<br/>and probe leases")]
    Circuit --> Router

    Web --> Delivery["Delivery service"]
    Delivery --> Redirect["Short-lived redirect"]
    Delivery --> Proxy["Controlled byte-range proxy"]
    Delivery --> Object["Temporary object"]
```

The current repository implements the catalog, provider manifests, deterministic ranking,
sequential fallback, normalized-result validation, an attempt ledger, transactional encrypted
delivery candidates, and disabled fixture-tested TwitterSaver/DLPanda adapters. TwitterSaver has a
reviewed redirect-only delivery path. ADR-0006 defines tuple-keyed health aggregation and
distributed circuit behavior. Attempts persist the concrete worker region; the opt-in worker health
loop aggregates distinct tasks into revisioned Redis snapshots; and the router enforces exact-key
open and half-open decisions. ADR-0007 defines production admission controls; work item 9.1 now
implements deny-first provider/platform/region rollout rules, deterministic task cohorts, durable
audit, and expiring Redis distribution. Idempotency, anonymous quotas, concurrency, and cleanup
remain scheduled for work items 9.2–9.4. Production policy calibration, yt-dlp isolation, proxying,
and temporary-object delivery are later milestones.

## Request lifecycle

1. The API parses an HTTP(S) URL and matches its hostname against the curated platform catalog. It
   never fetches the submitted URL during recognition.
2. Before public rollout, the API must apply ADR-0007 idempotency, duplicate, quota, and concurrency
   admission; the worker must require an affirmative runtime rollout rule.
3. An admitted request stores a short-lived task and enqueues only the task identifiers and
   resolution input.
4. The worker builds an eligible provider set using manifest capability, rollout permission, worker
   region, and circuit state.
5. Eligible providers are ordered by the platform-specific static priority plus bounded health,
   latency, and cost signals. Static priority remains the dominant signal.
6. The router calls one provider at a time. A retryable provider failure consumes one fallback slot;
   private, paid, authenticated, DRM-protected, and other terminal failures stop immediately.
7. Every provider output is parsed as an internal `ProviderResolution`. Its public result passes
   `ResolveResultSchema`; its generic candidates pass the private `@tikdd/delivery-core` schemas.
   Provider-native fields and direct URLs never enter the public result model.
8. On success, the worker encrypts candidate secrets and atomically writes the result, replacement
   candidate set, and sanitized attempt ledger. It is the source for future health scoring and
   operational dashboards.
9. The separate delivery service can issue an opaque, one-use ticket for a redirect candidate. It
   redeems the ticket atomically, decrypts the target, revalidates the provider/mode/exact-host
   policy and all DNS answers, then emits one 302 without following the upstream URL. Controlled
   streaming and expiring objects remain deferred.

Providers are not fanned out by default. Sequential fallback minimizes upstream load, duplicated
cost, rate-limit pressure, and inconsistent winner selection. Hedged requests may be added only for
measured high-value latency cases with strict cancellation and billing controls.

## Platform catalog versus provider registry

The platform catalog answers "what service does this URL belong to?" It owns stable platform slugs,
display names, host rules, yt-dlp extractor references, and product status.

The provider registry answers "which resolver can handle this platform here and now?" Each manifest
owns its provider kind, enabled state, regions, timeout, cost weight, and a priority per platform.
Adding a provider does not require editing platform detection when its platforms already exist.
Adding a platform does not make it publicly supported until at least one monitored production
provider meets the launch threshold.

See [Platform catalog](../platform-catalog.md) and [Routing policy](../routing-policy.md).
Operational configuration and protected diagnostics are documented in
[Provider health operations](../provider-health-operations.md).
Production admission and runtime rollout decisions are defined in
[ADR-0007](adr/0007-rollout-admission-and-abuse-controls.md).
Operator configuration and emergency-stop procedures are documented in
[Provider rollout operations](../provider-rollout-operations.md).

## Failure policy

| Failure class | Try next provider | Retry queue job | User-facing intent |
| --- | --- | --- | --- |
| Provider timeout, rate limit, challenge, schema change, outage | Yes, within budget | Yes | Temporarily unavailable |
| Provider says URL is unsupported | Yes | Usually no after all candidates | URL variant unsupported |
| Content missing | No by default | No | Content unavailable |
| Private, authentication, payment, DRM, geographic restriction | No | No | Terminal policy/content error |
| Invalid normalized result | Yes and trip health signal | Yes | Temporarily unavailable |

Adapters must translate upstream errors into TikDD's taxonomy. The router must never infer private or
restricted content is a transient outage and attempt to bypass it with another provider.

## Service responsibilities

### Web

- Server-rendered localized content, metadata, canonical URLs, hreflang, robots, and sitemaps.
- URL entry, rights confirmation, task progress, format selection, and actionable status messages.
- No provider credentials, provider-specific behavior, or media transfer.

### Control API

- Validate public contracts, recognize catalog hosts, persist tasks, and enqueue work.
- Apply abuse, quota, policy, and idempotency controls before production launch.
- Expose catalog status separately from per-request task results.

### Resolver workers

- Load validated provider manifests and route by platform, region, health, cost, and priority.
- Enforce per-route and per-provider deadlines and a bounded attempt budget.
- Normalize results, persist attempts, and never stream media to a browser.
- Run browser-style adapters and yt-dlp in dedicated resource-limited runner pools in production.

### Delivery

- Accept only a task and TikDD format identifier, never an arbitrary upstream URL.
- For the current redirect-only pilot, enforce exact-host policies, public DNS answers, candidate and
  ticket expiry, atomic one-use redemption, and rejection of server-held headers.
- Range proxying, redirect-chain traversal, concurrency/size enforcement, and object egress policies
  are required only when those delivery modes are introduced.

### Persistence and control state

- PostgreSQL stores task state, normalized results, provider attempts, encrypted short-lived
  delivery candidates, and hashed one-use tickets. The private candidate and ticket schemas live in
  `@tikdd/delivery-core`; they are not Web/API contracts.
- Redis carries short-lived jobs plus expiring routing-health snapshots and half-open probe leases;
  PostgreSQL attempts remain the reconstructable source of truth.
- A future object store holds expiring artifacts created by merge or transcode jobs.

## Deployment shape

Docker Compose runs PostgreSQL and Redis for local development. Initially the TypeScript services can
share one host while remaining separate processes. Production should split the low-risk control
plane from untrusted resolver execution, and further split adapter pools by runtime kind and region.
yt-dlp and FFmpeg versions are pinned in an isolated image and can be rolled back independently of
the Web and API.

## Non-functional targets for the first production pilot

- Control API p95 under 250 ms, excluding asynchronous provider work.
- Per-platform/provider success, latency, failure-class, fallback-depth, and cost metrics.
- No more than four provider attempts and one overall route deadline per task by default.
- Circuit breakers that operate per provider, platform, and region rather than globally.
- Hard expiry for source URLs, results, delivery candidates, and temporary objects.
- Zero provider secrets, cookies, raw payloads, or upstream download URLs in client responses/logs.
