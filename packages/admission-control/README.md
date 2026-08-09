# @tikdd/admission-control

This package owns the runtime-validated work item 9.3 boundary shared by the control API and resolver
workers. It derives one client address through explicit proxy networks, performs atomic anonymous
rate and active-task admission, and issues owner-scoped provider concurrency permits in Redis.

It does not own task persistence, idempotency, provider manifests, circuit health, rollout
permission, Web behavior, or delivery limits. Public responses expose only the generic error codes
defined by `@tikdd/contracts`.

Redis keys are versioned by deployment, region, and policy version. Client keys contain only a
purpose-specific server-keyed digest. Task permits and provider leases expire independently, and
terminal worker/API paths release them early. Provider concurrency is keyed by the exact provider,
platform, and worker region; a busy tuple is skipped without consuming the provider-call budget.

Run the Docker-backed verification with:

```sh
pnpm infra:up
pnpm verify:admission-control
```
