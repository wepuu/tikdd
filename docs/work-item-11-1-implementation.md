# Work item 11.1 implementation: cross-platform local pilot launcher

- Status: Implemented
- Date: 2026-08-10
- Scope: local development and explicitly authorized technical pilot startup
- Boundaries: ADR-0007, ADR-0008, and the work item 11 implementation plan

## Commands

| Command | Profile | Provider behavior |
| --- | --- | --- |
| `pnpm dev` | Offline | Development mock only; every real adapter is forced off |
| `pnpm dev:pilot` | Local live | Exact current-shell provider list and approval gates; mock forced off |
| `pnpm dev:stop` | Bounded stop | Terminates only process trees recorded in `tmp/local-stack/state.json` |
| `pnpm dev:services` | Low-level | Explicit Web/API/Worker/Delivery filter set for launcher maintenance |

The launcher owns ports 3000, 4000, and 4002. It refuses a duplicate owner lock or occupied port;
it never asks Next.js to choose a fallback port and never searches for arbitrary Node processes.
The original start command remains attached as the supervisor; `pnpm dev:stop` removes the ownership
state so that supervisor returns normally on Windows and Unix instead of leaving orphaned watchers.
Runtime state and per-service logs are ignored under `tmp/local-stack`. The state file contains only
mode, timestamps, local URL, selected provider IDs, log paths, and owned process IDs. It contains no
environment snapshot, key, proxy credential, URL submission, provider payload, or media data.
On shutdown the supervisor restores `next-env.d.ts` only when it still exactly matches Next.js's
known development-generated variant; concurrent user edits are preserved.

## Startup gate

Startup succeeds only after all of these checks pass:

1. no other launcher owns the local stack and all three application ports are free;
2. Docker Compose reports PostgreSQL and Redis as both `running` and `healthy`;
3. all repository migrations apply successfully;
4. Pilot mode has current-shell `TIKDD_LOCAL_LIVE_AUTHORIZED=true`, an exact non-empty
   `TIKDD_PILOT_PROVIDERS` list, and every provider-specific reviewed approval flag;
5. an explicit proxy, when provided, is an `http://` URL with a concrete host and port;
6. a direct or explicit-proxy TLS handshake reaches every selected provider page host without
   sending an HTTP request or reading provider content;
7. Web `/en`, API `/health/ready`, and Delivery `/health/ready` respond successfully;
8. an isolated, launch-token-scoped BullMQ probe is consumed by the Worker.

Any failure terminates only the child process trees already recorded by the current launcher and
removes its state/owner files. PostgreSQL, Redis, and their volumes stay running.

## Pilot environment contract

Authorization and provider approvals are intentionally accepted only from the current process
environment, not `.env`. At minimum:

```dotenv
TIKDD_LOCAL_LIVE_AUTHORIZED=true
TIKDD_PILOT_PROVIDERS=twittersaver,ssstwitter
TWITTERSAVER_TERMS_APPROVED=true
SSSTWITTER_TERMS_APPROVED=true
SSSTWITTER_DELIVERY_AUDIT_APPROVED=true
```

`dlpanda` instead requires `DLPANDA_TERMS_APPROVED=true`. An optional explicit
`TIKDD_PILOT_PROXY_URL=http://host:port` is copied to the child environment with Node's environment
proxy support enabled. Inherited `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, and lowercase variants
are removed first. The launcher never invents a proxy.

Pilot mode generates a unique AES-256 delivery key and opaque key ID in memory before spawning the
services. Neither value enters the state file or logs. The development rollout bypass remains
explicitly limited to this non-production profile; production continues to reject it.

## Verification

`pnpm test:work-item-11-1` covers offline force-disable behavior, current-shell authorization,
exact provider and approval validation, ephemeral delivery material, inherited-proxy removal,
Docker health decisions, and fail-fast provider egress behavior. Handoff additionally requires an
actual offline start, duplicate-start rejection, smoke task/Worker consumption, bounded stop, and
`pnpm check`.
