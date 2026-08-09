# Anonymous quota and provider concurrency operations

Work item 9.3 implements the trusted-proxy, anonymous quota, and distributed concurrency boundary
from [ADR-0007](architecture/adr/0007-rollout-admission-and-abuse-controls.md). Redis is mandatory
for this boundary in production; loss of Redis causes new public task admission to fail closed.

## Production configuration

Set `ADMISSION_CONTROL_ENABLED=true` in both API and worker deployments. Production startup rejects
an explicit or implicit disabled state. Both processes require identical `REDIS_URL` and
`ADMISSION_CONTROL_POLICY_JSON` values. The API also requires the work item 9.2
`TASK_ADMISSION_HMAC_KEY_BASE64URL`; its domain-separated client-address HMAC is used only for quota
identity.

The policy is runtime validated and includes:

- stable `version`, `deployment`, and concrete `region` namespace fields;
- client/global request limits and one fixed request window;
- client/global active-task limits and a bounded stale-permit TTL;
- default provider concurrency and exact/wildcard provider/platform/region overrides, with exact
  platform preceding exact region when both one-dimensional rules match;
- a provider owner-lease TTL that exceeds the reviewed provider call deadline.

Changing a policy version starts fresh Redis windows. Treat version changes as reviewed admission
changes and keep the global limits safe during the overlap. Region and deployment identifiers must
match the actual workload boundary rather than user-controlled request data.

## Trusted proxy boundary

`TRUSTED_PROXY_CIDRS` is a comma-separated list of exact reviewed proxy networks. Leave it empty for
direct exposure; the API ignores `X-Forwarded-For` and uses the normalized socket peer. When the
socket peer belongs to a trusted network, every forwarding value is parsed as an IP address and the
chain must contain one unambiguous client followed only by trusted proxies. Invalid, oversized,
attacker-prefixed, or multi-client chains are rejected before quota admission.

Do not add broad private ranges merely because a load balancer uses a private address. Use the
narrow subnet assigned to the reviewed ingress tier. The API disables Fastify's unrestricted proxy
trust and removes network addresses and forwarding headers from request log serialization.

## Admission behavior

One Redis Lua operation evaluates client/global rate and active-task limits. An accepted new task
receives an opaque permit. Concurrent requests with one idempotency key share a reference-counted
permit, so replay cannot be rejected merely because the winning task already consumes the caller's
active allowance. Each replay, conflict, duplicate, and failed admission releases only its own
reference. The worker releases the winning reference after successful or terminal completion;
retryable jobs retain it across queue attempts. TTL expiry bounds abandoned jobs.

- Rate rejection: `429 RATE_LIMITED` plus `Retry-After` from 1 to 60 seconds.
- Active-task rejection: `429 CONCURRENCY_LIMITED` plus the same bounded header.
- Redis/control failure: `503 ADMISSION_UNAVAILABLE`; no task or queue job is created.

Rate-limited and concurrency-limited responses contain no address, digest, counter, internal limit,
other task ID, or provider metadata. Redis stores no raw network address or forwarding header and
the quota digest is not reused for analytics.

## Provider concurrency

Workers acquire a lease for the exact provider/platform/region tuple immediately before an upstream
call. The lease contains a random owner token and can be released only by that owner. A full tuple
is skipped and routing continues sequentially to the next eligible provider without consuming the
provider-call attempt budget or a half-open circuit probe. Redis failure prevents the provider call;
lease expiry provides bounded crash recovery.

The provider lease TTL must cover the provider timeout with shutdown margin. Keep BullMQ worker
concurrency separate: queue concurrency limits active jobs, while these leases limit upstream calls
across the worker fleet.

## Verification

With Docker Redis healthy:

```sh
pnpm verify:admission-control
pnpm check
```

The verification uses a random TikDD-owned namespace and proves client/global rate ceilings,
client/global active-task ceilings, release and reacquisition, owner-safe provider permits, and
complete removal of verification keys. Unit tests cover spoofed forwarding chains, policy
specificity, fail-closed Redis errors, and concurrency-aware sequential fallback.
