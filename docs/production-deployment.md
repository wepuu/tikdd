# TikDD production deployment operations

This runbook implements Work Item 16 Phase B for the reviewed shared Ubuntu Server 24.04 LTS
`linux/amd64` host in `nl`. It creates no Cloudflare resources, firewall rules, Provider allocation,
or scheduler. The architecture contract remains
[the Work Item 16 deployment design](work-item-16-deployment-design.md).

## 1. Ownership and prerequisites

The host is shared with an existing PHP website. Host systemd owns `cloudflared`; host Nginx owns
virtual-host routing and the existing PHP-FPM path. TikDD Compose owns neither process and must not
replace `/etc/nginx/nginx.conf`, unrelated site files, PHP-FPM configuration, host firewall policy,
or Cloudflare credentials.

Required host software:

- Ubuntu Server 24.04 LTS x86_64;
- Docker Engine and the Compose v2 plugin;
- `flock`, Git and an operator shell;
- host Nginx and the infrastructure-owner-managed cloudflared service;
- access to immutable GHCR images, or a trusted `linux/amd64` build host;
- an approved encrypted off-host PostgreSQL backup and restore procedure before migration.

Recommended host layout:

```text
/opt/tikdd/current/                 reviewed release bundle
/opt/tikdd/releases/<git-sha>/      immutable release metadata and configuration
/etc/tikdd/production.env           root-owned non-secret deployment configuration
/etc/tikdd/secrets/                 root-owned application secret files
/var/lib/tikdd/postgres/            durable PostgreSQL data
/var/lib/tikdd/redis/               Redis AOF data
/run/tikdd/                         short-lived preflight attestation
/run/lock/tikdd-deploy.lock         host deployment lock
```

The paths are operator-configurable. Do not put production `.env` or secret files in the repository.

## 2. Images and immutable release identity

`Dockerfile.production` has three targets:

- `web` → `tikdd-web`;
- `admin` → `tikdd-admin`;
- `service` → `tikdd-service` for API, Worker, Delivery, Admin API and one-shot applications.

The build uses Node 24 and pnpm 11.9.0. Next applications are built in dedicated stages. The service
image keeps the current TypeScript-source runtime because workspace exports and start commands still
use `tsx`; `tsx` is therefore a production dependency. The runtime install uses `pnpm install
--prod --frozen-lockfile`, so Vitest, TypeScript and other development-only packages are excluded.
All application targets run as the non-root `node` user.

Build with the reviewed public origins and a full Git SHA:

```sh
export TIKDD_GIT_SHA="$(git rev-parse HEAD)"
docker build --file Dockerfile.production --target service \
  --build-arg TIKDD_GIT_SHA="$TIKDD_GIT_SHA" \
  --tag "ghcr.io/OWNER/tikdd-service:git-$TIKDD_GIT_SHA" .
docker build --file Dockerfile.production --target web \
  --build-arg TIKDD_GIT_SHA="$TIKDD_GIT_SHA" \
  --build-arg NEXT_PUBLIC_API_BASE_URL="https://API_HOST" \
  --build-arg NEXT_PUBLIC_DELIVERY_BASE_URL="https://DELIVERY_HOST" \
  --build-arg SITE_URL="https://WEB_HOST" \
  --tag "ghcr.io/OWNER/tikdd-web:git-$TIKDD_GIT_SHA" .
docker build --file Dockerfile.production --target admin \
  --build-arg TIKDD_GIT_SHA="$TIKDD_GIT_SHA" \
  --tag "ghcr.io/OWNER/tikdd-admin:git-$TIKDD_GIT_SHA" .
```

After publication, record each registry digest. A release may use a full-SHA tag for discovery, but
the approved release environment and receipt should pin `image@sha256:...`. Never deploy only
`latest`. Copy `deploy/release-manifest.example.json` into the release directory and record the Git
SHA, image digests, configuration checksum, Nginx template checksum, migration result, backup
reference and previous release.

## 3. Configuration and secrets

Copy `deploy/production.env.example` to a root-owned deployment file and replace every placeholder.
The template contains only non-secret values: region, deployment ID, public origins, host loopback
ports, image identities, datastore identifiers, bounded log/resource defaults and existing runtime
flags. Public Web/API/Delivery origins are also build inputs and must match the built image receipt.

Create `/etc/tikdd/secrets` with approximately mode `0700`. Secret files should be root-owned and
approximately `0400`, while remaining readable by Docker's secret mount mechanism. Compose mounts
only each service's required files under `/run/secrets`. `docker/secret-entrypoint.sh` accepts only a
fixed allowlist, rejects missing/empty required files, exports the value immediately before `exec`,
and never prints it.

Required files are listed by the `secrets` section of `compose.production.yml`. Important sharing:

- Worker and Delivery receive the same `delivery_encryption_key` and non-secret key ID;
- Web and Admin API receive the same `public_content_revalidation_secret`;
- Admin and Admin API receive the same `admin_origin_proof`; Nginx never receives or injects it;
- API receives the task-admission key;
- Worker and Canary receive the rollout cohort key;
- preflight and an internal API/Worker runtime receive the preflight HMAC key.

Use separate PostgreSQL DSN files for public-content read-only, API, Worker, Delivery, Admin,
operations and migration identities. The initial database bootstrap must grant only required
permissions. No Cloudflare token or Tunnel credential belongs in this directory or any container.

## 4. Compose topology

Validate the complete topology without starting it:

```sh
docker compose --env-file /etc/tikdd/production.env \
  -f compose.production.yml --profile admin --profile ops --profile admin-ops config --quiet
pnpm verify:work-item-16
```

Continuously available services are Web, API, Worker, Delivery, PostgreSQL and Redis. The Admin pair
uses the `admin` profile and is owner-on-demand. Migration, preflight, Canary, evidence, cleanup,
cleanup dry-run and administrator account maintenance are one-shot profile services; none is a
scheduler.

Only these publications exist, all configurable and explicit loopback binds:

```text
127.0.0.1:<web-host-port>      -> Web 3000
127.0.0.1:<api-host-port>      -> API 4000
127.0.0.1:<delivery-host-port> -> Delivery 4002
127.0.0.1:<admin-host-port>    -> Admin UI/BFF 3001
```

`admin` uses `network_mode: service:admin-api`. The `admin-api` service owns the `3001` host
publication and the shared `data`/`provider-egress` namespace. Admin API binds
`127.0.0.1:4100` inside that namespace. Port 4100 has no publication and is inaccessible through a
normal Docker network address.

The only Docker networks are `data` and `provider-egress`. `data` is internal and contains explicit
PostgreSQL/Redis consumers. Only Worker, Delivery, Admin API and Canary join `provider-egress`.
Initial Provider qualification uses the normal deterministic NL IPv4 path; no proxy rotation,
residential proxy, account cookie, alternate-region tunnel or challenge bypass is included.

## 5. PostgreSQL and Redis

PostgreSQL persists at `/var/lib/tikdd/postgres` by default and has no host port. Initial low-volume
defaults are 30 maximum server connections, 128 MB shared buffers, 2 MB work memory and 32 MB
maintenance memory. Application pools default to four connections through
`TIKDD_DATABASE_POOL_MAX`; Web retains its existing two-connection read pool. These are shared-host
starting values, not universal tuning recommendations. Measure connection use and memory before
raising them.

Redis persists AOF data at `/var/lib/tikdd/redis`, requires authentication, has no host port and
starts with a 128 MB `maxmemory` ceiling plus `noeviction`. TikDD stores BullMQ jobs, sessions,
leases, rate counters, circuits and policy projections in Redis. Silent eviction could violate
coordination and fail-closed behavior, so reaching the ceiling must fail writes visibly rather than
discard keys. PostgreSQL remains durable business authority, but Redis loss can strand queued work
and must be operationally handled rather than treated as healthy data loss.

## 6. Explicit migration and backup gate

Applications never auto-migrate. A release must:

1. acquire `/run/lock/tikdd-deploy.lock` with `flock`;
2. verify the infrastructure-owner backup prerequisite through `TIKDD_BACKUP_VERIFY_COMMAND`;
3. run `docker compose --profile ops run --rm migration` exactly once;
4. stop the release on any nonzero result.

No off-host destination is selected by this repository. Real rollout remains blocked until the
owner defines encrypted destination, retention, restore procedure and periodic restore-test policy.
There is no automatic down migration and no claim of schema downgrade safety.

## 7. Health, startup and manual operations

PostgreSQL uses `pg_isready`; Redis uses an authenticated `PING`. API and Delivery check their
existing readiness endpoints. Worker uses `probe:production`, which performs bounded PostgreSQL
`SELECT 1` and authenticated Redis `PING`. Web checks its content-health route. Admin API checks its
private readiness endpoint; Admin checks both BFF and loopback API liveness. No health check calls a
Provider.

Start the fail-closed public foundation:

```sh
docker compose --env-file /etc/tikdd/production.env -f compose.production.yml up -d postgres redis
docker compose --env-file /etc/tikdd/production.env -f compose.production.yml --profile ops run --rm migration
docker compose --env-file /etc/tikdd/production.env -f compose.production.yml up -d web api worker delivery
docker compose --env-file /etc/tikdd/production.env -f compose.production.yml --profile admin up -d admin-api admin
```

Initialize or recover the single owner account interactively:

```sh
docker compose --env-file /etc/tikdd/production.env -f compose.production.yml \
  --profile admin-ops run --rm admin-account pnpm admin:account init --username owner
```

Manual one-shot operations:

```sh
docker compose --env-file /etc/tikdd/production.env -f compose.production.yml --profile ops run --rm preflight
docker compose --env-file /etc/tikdd/production.env -f compose.production.yml --profile ops run --rm canary
docker compose --env-file /etc/tikdd/production.env -f compose.production.yml --profile ops run --rm evidence
docker compose --env-file /etc/tikdd/production.env -f compose.production.yml --profile ops run --rm cleanup
docker compose --env-file /etc/tikdd/production.env -f compose.production.yml --profile ops run --rm cleanup-dry-run
```

The preflight consumes current Manifest capabilities and fails closed. It never grants or increases
traffic. Canary authorization remains exact-tuple and independent. Work Item 16 does not schedule
any command or interpret an unscheduled job as stale.

## 8. Host Nginx and Cloudflare Tunnel

Render `deploy/nginx/tikdd.conf.template` into a new TikDD-specific site file by replacing the four
hostnames, the configurable Nginx origin port and the four application host ports. The template
listens only on `127.0.0.1:<origin-port>`, removes query strings from TikDD access-log request lines,
exposes only public API/Delivery routes, and never proxies Admin API or Provider diagnostics.

Install safely:

1. render into a temporary file and review the diff;
2. install only the TikDD site file atomically;
3. run `nginx -t`;
4. reload Nginx only after validation;
5. regression-test every existing PHP and non-TikDD site.

Host cloudflared routes approved public hostnames to the shared loopback Nginx origin while
preserving the Host header for `server_name` routing. The cloudflared systemd lifecycle and Tunnel
credential remain infrastructure-owned. During migration, existing public 80/443 behavior may stay
available. Only after every shared website passes Tunnel verification may the infrastructure owner
close public inbound 80/443. TikDD scripts make no firewall change.

## 9. Shared-host resources, logs and disk

The example limits permit approximately 2.06 GiB for continuously resident TikDD containers at
their hard ceilings: Web 384 MiB, API 320 MiB, Worker 384 MiB, Delivery 320 MiB, PostgreSQL 512 MiB
and Redis 192 MiB. Admin's two 384 MiB ceilings apply only while the owner console is running;
one-shot jobs use a 384 MiB ceiling. These are conservative safety ceilings, not reservations and
not evidence that TikDD owns 4 GB. Capture host/PHP and container idle/peak observations before
production acceptance; loosen only with measured headroom.

The 2026-08-30 Docker Desktop smoke observed these approximate post-start idle values: Web 139 MiB,
API 185 MiB, Worker 180 MiB, Delivery 173 MiB, PostgreSQL 41 MiB and Redis 5 MiB, or about 722 MiB
without Admin. The on-demand Admin BFF and Admin API added approximately 143 MiB and 190 MiB,
bringing the complete smoke topology to about 1.03 GiB. These Windows/Docker Desktop observations
support the initial ceilings but do not replace measurement on the shared NL host under traffic.

Docker's bounded local logging defaults to 20 MB × 5 files. Six continuous containers therefore
have a theoretical rotated-log ceiling of about 600 MB; the on-demand Admin pair can add about
200 MB while running. One-shot jobs should be removed after execution. Nginx, system, PHP,
PostgreSQL, Redis AOF, Docker layers and release artifacts still consume the same shared 50 GB disk.

Retain current and previous approved image digests. Remove an older digest only after proving no
active/rollback release references it. Build-cache cleanup must target confirmed cache only. Never
use `docker system prune -a --volumes` as routine maintenance, never include PostgreSQL/Redis volumes
in generic cleanup, and never automatically delete the rollback release.

## 10. Release and rollback

`scripts/production-release.sh deploy` validates Compose and static boundaries, obtains `flock`,
requires the owner-supplied backup verification hook, pulls immutable images, starts datastores,
runs the migration once, starts applications and runs the internal preflight. A successful release
does not create rollout rules or Provider traffic. Nginx installation/reload remains a separate
reviewed host action after application health is proven.

Rollback requires `TIKDD_ROLLBACK_ENV` pointing to the previous approved immutable image/config
bundle and an explicit `TIKDD_SCHEMA_COMPATIBILITY_CONFIRMED=true`. It preserves PostgreSQL data,
route-policy/audit history and evidence. It never runs reverse migrations. If the previous
application is incompatible with the current schema, stop and use a forward fix or a coordinated
database restoration under the owner-approved restore procedure.

## 11. Offline verification and troubleshooting

Run static and Compose validation:

```sh
pnpm verify:work-item-16
```

With Docker available, `pnpm smoke:work-item-16` creates only test secrets and named
volumes in the `tikdd-wi16-smoke` project, builds the three image families, migrates a local test
database, verifies the four loopback publications, confirms private ports stay unpublished, starts
one-shot commands and removes the exact smoke project afterward. Provider flags, Canary
authorization and rollout remain false; no media or Provider request is made.

Troubleshooting order:

1. `docker compose ... config --quiet` for interpolation/Compose errors;
2. secret file presence and permissions, without printing contents;
3. PostgreSQL/Redis health and bounded disk availability;
4. application container health and the sanitized service log;
5. exact loopback listener inventory with `ss -lnt`;
6. rendered TikDD site diff and `nginx -t`;
7. host cloudflared status, handled outside Compose.

## 12. Work Item 17 boundary

Work Item 17 alone owns cron/timers, recurring execution, last/next-run state, freshness,
missed-run detection, scheduling alerts and supervision. This foundation supplies only manually
invokable one-shot commands. It does not implement a scheduling container, loop, systemd timer or
freshness claim.
