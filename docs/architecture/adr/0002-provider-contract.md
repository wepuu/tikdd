# ADR-0002: Provider isolation and normalized contracts

- Status: Accepted
- Date: 2026-08-03

## Context

Third-party APIs, HTML-based download sites, and yt-dlp expose incompatible and unstable fields. If
provider payloads reach the browser or persistence directly, every upstream change becomes a product
and security incident.

## Decision

All provider implementations conform to `ResolverProvider`. Their output is parsed by the versioned
`ResolveResultSchema` before persistence. Public formats use TikDD-generated identifiers and contain
capabilities, never upstream URLs, cookies, or secret headers.

Provider scheduling will use platform support, observed health, cost, region, and capability. A
single request has a bounded fallback budget; providers are not fanned out by default.

ADR-0004 specifies the later accepted catalog, manifest, ranking, and failure-decision model.

## Consequences

- Provider changes remain local and contract-testable.
- Adding a field requires a versioned contract and OpenAPI change.
- Internal delivery candidates need a separate encrypted/short-lived storage model before real media
  delivery can ship.
