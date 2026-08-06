# ADR-0004: Dynamic platform catalog and capability-based provider routing

- Status: Accepted
- Date: 2026-08-04

## Context

TikDD must cover many platform families and continually add third-party download-site adapters. A
fixed platform enum couples every platform addition to public contracts, database constraints, and
all applications. A single global provider order is also incorrect because one provider can be best
for Instagram but a last resort for YouTube.

The yt-dlp supported-sites list is broad and fast-changing. It is useful discovery data but is not a
reliability guarantee or a safe URL allowlist.

## Decision

Use a curated platform catalog with stable lowercase slugs and explicit host rules. Public contracts
accept validated platform slugs rather than a closed enum. Catalog status separately expresses
planned, experimental, stable, and paused product support.

Every provider exposes a runtime-validated manifest with kind, enabled state, regions, timeout, cost
weight, and platform-specific priorities. The worker selects eligible providers, ranks them using
static priority plus bounded health/latency/cost signals, and calls them sequentially within attempt
and time budgets.

Adapters classify errors with independent `fallbackAllowed` and `retryable` decisions. Terminal
private, authenticated, paid, DRM, and policy failures stop immediately. Every call is recorded in a
sanitized attempt ledger, and every successful payload must pass the unified result schema.

## Consequences

- Platforms and providers evolve independently, and adapter quality can vary by platform.
- Fallback is deterministic, observable, bounded, and cheaper than default fan-out.
- Adding a catalog entry does not imply production support or create an indexable SEO page.
- A health service and distributed circuit state are required before multi-instance production.
- Broad generic extraction is deliberately constrained by reviewed host admission rules.
- The provider registry must eventually be configuration-backed so routing changes and kill switches
  do not require a worker image rebuild.

