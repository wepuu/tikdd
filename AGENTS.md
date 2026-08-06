# TikDD agent guide

## Scope

TikDD is a multilingual media-resolution tool. Keep the SEO web application, control-plane API,
resolver workers, and media delivery path decoupled.

## Required boundaries

- Provider-specific fields must never cross `packages/providers` without normalization through
  `@tikdd/contracts`.
- Platform IDs are catalog slugs, not a closed enum. Add/review explicit host rules and spoofed-host
  tests in `@tikdd/platform`; do not accept arbitrary hosts through a generic extractor.
- Every provider owns a runtime-validated manifest. Platform support and priority belong in that
  manifest, never in Web/API conditionals.
- Fallback must be sequential and bounded. Preserve typed terminal versus retryable/fallback errors
  and persist the sanitized attempt ledger.
- Do not add downloadable URLs to the public resolve-result model. Delivery credentials and
  upstream headers belong to the delivery service.
- Treat every submitted URL and every upstream response as untrusted input.
- Never turn the delivery service into a general-purpose proxy. New providers require an explicit
  host allowlist and redirect validation.
- Task and result pages must remain non-indexable. Only stable localized content pages belong in
  sitemaps.
- Mock providers are development-only and must refuse to start in production.

## Working agreement

1. Read the relevant ADR and package README before changing a boundary.
2. Update OpenAPI and `@tikdd/contracts` together.
3. Add provider fixtures, error-decision tests, and routing contract tests for every adapter change.
4. Run `pnpm check` before handoff.
5. Create an ADR for decisions that alter persistence, task states, provider selection, or media
   delivery.

## Common commands

- `pnpm infra:up` starts PostgreSQL and Redis.
- `pnpm infra:status` reports local container health.
- `pnpm db:migrate` applies local migrations.
- `pnpm dev` starts all applications.
- `pnpm smoke:local` verifies a non-original platform through API, queue, worker, and persistence.
- `pnpm check` runs lint, type checks, tests, and production builds.
