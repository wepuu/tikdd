# ADR-0058: isolated self-hosted Cobalt secondary Provider

## Status

Accepted for Work Item 121. No Cobalt platform is production-enabled by this decision.

## Context

The official Cobalt API is protected and is not a dependable anonymous upstream for TikDD. Cobalt
is open source and can be run separately, but it can also return provider tunnels or local-processing
artifacts that would turn TikDD Delivery into a general-purpose media proxy. The NL VPS has limited
memory, so an unbounded media worker would also compete with the existing API, Worker, Redis, and
PostgreSQL services.

## Decision

- Run the pinned Cobalt image as a private, profile-gated `cobalt-api` Docker service on the existing
  `provider-egress` network. It has no host port, read-only filesystem, no-new-privileges, no Linux
  capabilities, 512 MiB memory, one CPU, and one-request Worker concurrency.
- Authenticate Worker-to-Cobalt calls with a dedicated key stored in the mode-600 release
  environment, and keep Cobalt's UUID key registry in a Docker secret. Do not send user cookies,
  browser tokens, or Turnstile values. Disable YouTube and xHamster in the Cobalt service for this
  work item.
- Normalize only `redirect` and `picker` responses. Reject `tunnel` and `local-processing`; do not
  add Blob storage, streaming proxying, or Provider-page handoff.
- Keep platform capabilities fixture-only until each platform has an independent direct-CDN Host
  policy, two-sample Range check, cross-exit replay, and browser download audit. The platform must
  then be explicitly listed in `COBALT_DELIVERY_VERIFIED_PLATFORMS` and enabled by the three gates.
- Publish Cobalt source/license provenance and the exact image digest with each release. Cobalt is
  AGPL-3.0; local modifications must be published under that license.

## Consequences

Cobalt can provide a bounded fallback without exposing a public Cobalt endpoint, but it adds a
resource-heavy container and a second software supply chain. A platform remains unavailable until
its media hosts are reviewed; a successful Cobalt JSON response alone is never enough to route
production traffic.
