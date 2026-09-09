# Work Item 27 — Beta production closeout and lightweight operability

Status: implementation on `codex/wi27-beta-operability`; no production change in this work item.

## Scope

The X and Instagram Betas are already live from GitHub-built images. This slice keeps the release
loop small and useful while the product is used:

- Web maps retryable provider/transport failures, unavailable content, and expired tasks to
  provider-neutral copy. Retry and re-resolve actions are explicit; provider names, upstream URLs,
  cookies, and headers never reach the browser.
- `pnpm beta:report` reads public X/Instagram task, Provider-attempt, and Delivery-outcome tables
  for a bounded 1–168 hour window and prints aggregate counts, rates, failure classes, and the
  latest event timestamp. It performs no writes and emits no URL, task ID, media, or Provider
  identity.

No migration, public endpoint, telemetry stream, always-on service, Provider gate, rollout rule,
Admin process, or calibration profile is added or changed.

## Release loop

1. Run focused Web and persistence tests, then `pnpm check`.
2. Open a PR and wait for CI.
3. After merge, verify the exact GitHub Web/Service image tags and digests.
4. Back up PostgreSQL, deploy manually, and keep X/Instagram rollout and gates unchanged.
5. Complete one real X or Instagram download, run a short health watch, and roll back quickly if a
   core health or delivery gate fails.

Admin publication and calibration remain separate, on-demand decisions and are not prerequisites
for this Beta loop.
