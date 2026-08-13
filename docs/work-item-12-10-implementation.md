# Work item 12.10 implementation — settings and recovery tools

Completed on 2026-08-13.

## Delivered

- Versioned per-Locale site name, footer identity, and default social metadata using the existing
  shared-content draft and immutable publication flow.
- Bounded Locale controls for direction, fallback, enabled state, and default Locale using the
  existing optimistic-concurrency command boundary.
- A sanitized settings projection for the `tikdd / nl` deployment: password owner access,
  Cloudflare/Nginx deployment markers, PostgreSQL, Redis, queue, scheduler, and snapshot readiness.
- Secret presence is represented only as configured/missing for origin proof, CSRF signing,
  command signing, and Web revalidation.
- Exact known-snapshot recovery: retry publication, rebuild the active snapshot, revalidate its
  persisted affected paths, and select known rollback revisions in the existing publication desk.

Recovery remains owner-authenticated, CSRF-bound, idempotent, revision checked, deployment scoped,
and Postgres verified. It does not accept arbitrary URLs, paths, cache keys, SQL, shell input, raw
logs, tasks, media, Provider payloads, or secret values.

## Verification

Run:

```text
pnpm test:work-item-12-10
pnpm check
```
