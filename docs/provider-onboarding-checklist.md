# Provider onboarding checklist

This checklist is the entry point for the next free-provider capability batch. It is intentionally
small: a candidate stays disabled until every relevant item is complete. SaveFromIns remains the
current Instagram Beta route while candidates are evaluated.

## Candidate boundary

- [ ] Public URL input only; no account cookies, login, paid API key, or challenge bypass.
- [ ] Candidate endpoint and every redirect host have an explicit host allowlist review.
- [ ] Platform host rules and spoofed-host tests are present in `@tikdd/platform`.
- [ ] Provider does not receive or return raw user credentials, cookies, or unrelated headers.
- [ ] No request is made from local development or CI to a third-party Provider.

## Manifest and runtime limits

- [ ] Manifest is runtime-validated and declares platform, region, priority, timeout and delivery
      mode explicitly.
- [ ] Production capability uses a supported delivery mode and is disabled by default.
- [ ] Timeout, response-size, redirect-hop, concurrency and retry limits are explicit and bounded.
- [ ] Mock or fixture adapters refuse to start in production.

## Normalised result and fallback

- [ ] Success fixture covers a valid normalised result and at least one supported delivery mode.
- [ ] Rate-limit, timeout/network/5xx, challenge/authentication, private/not-found and schema
      change fixtures are present.
- [ ] Terminal errors never fall through to an unrelated Provider; retryable errors are retried
      only within the adapter's bounded budget.
- [ ] Attempt ledger contains only sanitised provider id, code, timing and route metadata.
- [ ] No public resolve-result model contains a downloadable upstream URL.

## Delivery and release gate

- [ ] Delivery host and redirect validation tests pass; the delivery service does not proxy bytes.
- [ ] `pnpm check` and Compose validation pass.
- [ ] Admin effective route plan shows the candidate as excluded while disabled and as a real
      primary/fallback only after rollout and health gates allow it.
- [ ] Candidate is tested in isolation before any allocation is granted.
- [ ] Production deployment uses the GitHub SHA image, includes a database/config backup and has
      an explicit rollback command.

## Decision record

Record only the decision needed for the next batch: `accepted`, `deferred`, or `rejected`, plus a
short reason. Do not add a new audit subsystem or collect provider response bodies.
