# Provider development guide

Every third-party download site, third-party API, and yt-dlp runner is a provider adapter behind the
same contract. An adapter owns upstream quirks; shared contracts own what TikDD exposes.

## Contract

Implement `ResolverProvider` from `@tikdd/providers`:

- `manifest.id` is stable, unique, lowercase, and safe for metrics.
- `manifest.kind` is `site-adapter`, `api`, `yt-dlp`, or development-only `mock`.
- `manifest.platforms` declares a priority per supported platform family.
- `manifest.regions`, `enabled`, `timeoutMs`, and `costWeight` participate in routing.
- `resolve` honors its abort signal and returns an internal `ProviderResolution` containing a
  complete normalized `ResolveResult` plus generic delivery candidates.

Manifests are validated at router construction. Candidates reference a reviewed `hostPolicyId`; an
upstream response cannot supply or widen its own host policy. Do not add provider-native response
objects to shared or public contracts.

## Suggested adapter layout

```text
packages/providers/src/adapters/<provider-id>/
  index.ts               adapter and manifest
  client.ts              bounded upstream client
  normalize.ts           provider payload → ResolveResult
  errors.ts              upstream error mapping
  fixtures/              sanitized success and failure payloads
  adapter.test.ts         fixture and contract tests
  README.md               capability/terms/operations notes
```

Adapters needing a headless browser do not run in the general TypeScript worker process in
production. Place them behind a constrained runner boundary and keep the same logical provider
contract.

## Required provider record

Every real adapter documents:

- supported platform families, URL variants, regions, media types, and known limitations;
- terms/commercial-use review owner, review date, and credential/data-retention policy;
- upstream host and redirect allowlists;
- provider and route timeouts, response-size ceiling, concurrency, rate limit, and retry behavior;
- error mapping for invalid/unsupported URLs, removed/private/restricted content, rate limits,
  challenges, upstream schema changes, timeouts, and network failures;
- sanitized JSON/HTML fixtures for success and every failure decision;
- scheduled canary URLs with documented ownership/authorization and expected results;
- kill switch, dashboard, alert thresholds, and rollback owner.

## Normalization rules

- Generate stable TikDD format identifiers from non-secret provider fields.
- Use `null` for unknown measurements; never invent bitrate, size, duration, or codecs.
- Mark audio-only and video-only formats explicitly.
- Keep direct media URLs and approved required upstream headers only in internal delivery candidates;
  the worker encrypts them before transactional persistence.
- Production results must map every public format to exactly one candidate. Resolution-only output
  is limited to development mocks and technical fixture/canary evaluation.
- Reject unknown URL schemes, unexpected redirects, oversized responses, invalid MIME types, and
  payloads that fail the versioned result schema.
- Preserve warnings that help users choose a format; remove debug and implementation details.

## Error mapping

Do not throw anonymous errors for expected upstream behavior. Use `ProviderError` and choose both
decisions deliberately:

- `fallbackAllowed` controls whether another provider is tried in the current route.
- `retryable` controls whether a later queue attempt may rerun the route.

A private or paid response is not retryable and must not allow fallback. A challenge page or timeout
normally allows both. An unsupported URL variant may allow fallback but is normally not useful to
retry after all candidates reject it.

## Test matrix

1. Manifest validation and declared platform capabilities.
2. Successful normalization for each platform/media shape.
3. Every upstream failure mapped to the expected failure, retry, and fallback decisions.
4. Abort/timeout behavior, response byte ceiling, redirect limit, and concurrency lease.
5. Spoofed host, redirect-to-private-network, malformed MIME, and oversized payload rejection.
6. Proof that no upstream URL, token, cookie, secret header, or raw payload reaches the public result.
7. Router integration proving priority order and fallback to a second adapter.

Pull-request tests use fixtures and never depend on a live third-party site. Scheduled canaries are an
operations signal outside deterministic CI.

## Rollout

Ship disabled, pass fixtures, pass scheduled canaries, enable internal traffic, then ramp by
platform and region. Open the circuit on elevated schema errors, challenge pages, timeouts, or invalid
media responses. A new provider must be removable from routing without a Web or API deploy.

Current records:

- [TwitterSaver](providers/twittersaver.md)
- [DLPanda](providers/dlpanda.md)
