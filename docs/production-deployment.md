# TikDD production deployment operations

This runbook implements the reviewed deployment foundation and Work Item 17 operational services
for the shared Ubuntu Server 24.04 LTS `linux/amd64` host in `nl`. It creates no Cloudflare
resources or public Provider allocation. Work Item 17 uses repository-owned host systemd timers
for three isolated one-shot jobs; the architecture contract remains
[the Work Item 16 deployment design](work-item-16-deployment-design.md).

> **Current C2 owner state (2026-08-30):** the old TikDD deployment described by the historical C1
> audit has already been shut down and its runtime resources released. It must not be restored or
> treated as a rollback target. The host still has shared PHP workloads; Nginx, PHP-FPM, MySQL and
> host Redis remain protected. Original C1 measurements remain historical evidence; the newer C2
> measurements in `work-item-16-production-staging.md` control deployment.

## 1. Ownership and prerequisites

The audited NL VPS is the approved production target. The owner reported one remaining PHP site;
C2 host inspection found three active Nginx PHP site configurations, so all three are protected
until the owner retires them explicitly. Host Nginx, PHP-FPM, MySQL, host Redis and required
hosting-panel services are permanent shared infrastructure. TikDD Compose owns none of them and must not stop,
restart, reconfigure, remove, prune or count their memory as reclaimable. Host systemd will own the
shared `cloudflared` service after its separately approved Phase C2 installation.

Required host software:

- Ubuntu Server 24.04 LTS x86_64;
- Docker Engine and the Compose v2 plugin;
- `flock`, Git and an operator shell;
- host Nginx; cloudflared is a Phase C2 host preparation prerequisite before ingress cutover;
- access to immutable GHCR images, or a trusted `linux/amd64` build host;
- a reviewed stage-verification command that checks host resources and every existing site;
- either a verified backup hook for an existing TikDD PostgreSQL data directory or an explicit
  one-time confirmation that the initial PostgreSQL directory is empty.

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

Create a dedicated host group with the reviewed numeric GID `TIKDD_SECRETS_GID` (initial NL plan:
`1999`). Use a root-owned, group-traversable `/etc/tikdd/secrets` directory, normally `0750`, and
root-owned secret files readable only by that group, normally `0440`. Application containers receive
the numeric GID only as a supplemental group and remain the unprivileged `node` user. Compose mounts
only each service's required files under `/run/secrets`. `docker/secret-entrypoint.sh` accepts only a
fixed allowlist, rejects missing/empty required files, exports the value immediately before `exec`,
and never prints it.

Phase C2 must prove native-Linux readability from each image before Gate A. Do not assume the Docker
Desktop result proves host behavior, do not use world-readable files, and do not proceed if a
container can read a secret it did not declare. PostgreSQL/Redis image UID ownership and datastore
directory ownership require a separate one-shot permission check.

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

The Docker networks are `data`, `host-ingress` and `provider-egress`. `data` is internal and
contains explicit PostgreSQL/Redis consumers. `host-ingress` is limited to Web and API, defaults
published ports to loopback, and disables IP masquerading so it cannot become general egress.
Only Worker, Delivery, Admin API and Canary join `provider-egress`.
The audited NL plan reserves `172.30.40.0/24` (gateway `172.30.40.1`) for `data` and
`172.30.41.0/24` (gateway `172.30.41.1`) for `provider-egress`, plus `172.30.42.0/24` (gateway
`172.30.42.1`) for `host-ingress`. Recheck host routes immediately before creation. After API
startup, confirm its actual socket peer before accepting `TRUSTED_PROXY_CIDRS=172.30.42.1/32`;
never trust a broad private range.
Initial Provider qualification uses the normal deterministic NL IPv4 path; no proxy rotation,
residential proxy, account cookie, alternate-region tunnel or challenge bypass is included.

## 5. PostgreSQL and Redis

The shared host and TikDD datastore roles intentionally coexist.

### Host MySQL

Permanent shared infrastructure used by existing PHP sites. It remains running throughout every
TikDD stage and is not a TikDD lifecycle or memory-reclamation target. TikDD does not reuse it.

### Host Redis

Permanent shared infrastructure used by existing websites/services. Its port, credentials,
persistence, eviction policy and lifecycle remain unrelated to TikDD. It remains running and is
not a reclamation target.

### TikDD PostgreSQL

PostgreSQL persists at `/var/lib/tikdd/postgres` by default and has no host port. Initial low-volume
defaults are 30 maximum server connections, 128 MB shared buffers, 2 MB work memory and 32 MB
maintenance memory. Application pools default to four connections through
`TIKDD_DATABASE_POOL_MAX`; Web retains its existing two-connection read pool. These are shared-host
starting values, not universal tuning recommendations. Measure connection use and memory before
raising them.

TikDD PostgreSQL coexists with host MySQL. An application-level legacy-data migration is a separate
decision and must not be inferred merely because both databases exist.

### TikDD Redis

Redis persists AOF data at `/var/lib/tikdd/redis`, requires authentication, has no host port and
starts with a 128 MB `maxmemory` ceiling plus `noeviction`. TikDD stores BullMQ jobs, sessions,
leases, rate counters, circuits and policy projections in Redis. Silent eviction could violate
coordination and fail-closed behavior, so reaching the ceiling must fail writes visibly rather than
discard keys. PostgreSQL remains durable business authority, but Redis loss can strand queued work
and must be operationally handled rather than treated as healthy data loss.

The production Redis container is pinned to the image's observed `999:1000` identity, receives only
the supplemental secret-reader GID, drops every Linux capability and uses a read-only root
filesystem. `/run/tikdd-redis` is a private `0700` tmpfs owned by that identity; `/data` remains the
only durable writable bind mount. Revalidate the image UID/GID before changing the pinned Redis
digest.

Docker Compose may implement local `configs` as bind mounts and ignore the requested executable
mode. The Redis entrypoint and health-check configs are invoked explicitly through `/bin/sh`, so
release archive extraction does not need to preserve executable bits for these mounted files.

TikDD Redis coexists with host Redis. It has no host publication and must not share the host Redis
configuration, credentials, persistence or lifecycle.

## 6. Explicit migration and backup gate

Applications never auto-migrate. A release must:

1. acquire `/run/lock/tikdd-deploy.lock` with `flock`;
2. run the shared-host baseline stage gate;
3. use `TIKDD_BACKUP_VERIFY_COMMAND` for every non-empty PostgreSQL data directory; or, only for the
   first empty database, require `TIKDD_INITIAL_EMPTY_DATABASE_CONFIRMED=true` and prove the target
   directory contains no entry;
4. run `docker compose --profile ops run --rm migration` exactly once;
5. stop the release on any nonzero result.

Missing off-host backup does not block creation and migration of the first empty TikDD database.
The confirmation is single-use: change it back to `false` immediately after initialization. Once
production traffic can create data, use the reviewed [P0-DR-01 backup and restore drill](p0-dr-01-backup-restore.md)
before treating the database as recoverable. The one-shot scripts
`scripts/production-backup-postgres.sh`, `scripts/verify-postgres-backup.sh`, and
`scripts/restore-postgres-drill.sh` keep plaintext temporary, encrypt with a public-only
recipient on production, and require an off-host copy for restore. They do not schedule backups or
choose a destination; the owner must separately define destination, retention, schedule and
periodic restore testing. The existing MySQL/site backup timer is unrelated evidence. There is no
automatic down migration and no claim of schema downgrade safety.

## 7. Health, startup and manual operations

PostgreSQL uses `pg_isready`; Redis uses an authenticated `PING`. API and Delivery check their
existing readiness endpoints. Worker uses `probe:production`, which performs bounded PostgreSQL
`SELECT 1` and authenticated Redis `PING`. Web checks its content-health route. Admin API checks its
private readiness endpoint; Admin checks both BFF and loopback API liveness. No health check calls a
Provider.

`TIKDD_STAGE_VERIFY_COMMAND` is mandatory for `scripts/production-release.sh deploy`. It receives
the current step through `TIKDD_STAGE` and must be a reviewed read-only executable. It checks
available RAM, swap level and growth, load/CPU pressure, OOM events, container restarts, disk,
PostgreSQL/TikDD Redis and the existing PHP/MySQL/host-Redis regression boundary. After Gate C it
also checks loopback-only TikDD Web/API/Delivery/staging/Admin host behavior and requires a healthy,
zero-restart cloudflared connector with at least two HA connections. It must not use the retired
TikDD WordPress paths as success signals. A nonzero result holds deployment with already-started
TikDD services available for bounded diagnosis; it never stops a shared host service automatically.

Start the fail-closed public foundation through the staged release command:

```sh
export TIKDD_STAGE_VERIFY_COMMAND=/usr/local/sbin/tikdd-stage-gate
# Only for the first proven-empty PostgreSQL directory; otherwise export the reviewed backup hook.
export TIKDD_INITIAL_EMPTY_DATABASE_CONFIRMED=true
TIKDD_RELEASE_ENV=/etc/tikdd/production.env scripts/production-release.sh deploy
```

These release-control variables belong to the root operator environment, not the Compose
`production.env` injected into application containers. Subsequent releases leave the empty-database
confirmation unset/false and export `TIKDD_BACKUP_VERIFY_COMMAND` instead.

The enforced order is baseline, image preparation, PostgreSQL, TikDD Redis, migration, API,
Delivery, Worker, Web and preflight, with the stage gate after every significant step. Host MySQL,
host Redis, shared PHP-FPM, Nginx and all existing sites remain online. Admin is excluded from the
continuous deploy path and is started only when needed:

```sh
TIKDD_RELEASE_ENV=/etc/tikdd/production.env scripts/production-release.sh admin-start
TIKDD_RELEASE_ENV=/etc/tikdd/production.env scripts/production-release.sh admin-stop
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

Render `deploy/nginx/tikdd.conf.template` into a new TikDD-specific site file by replacing the
canonical Web, apex, temporary Gate C, API and Delivery hostnames plus the configurable Nginx origin
port and three public application host ports. The template listens only on
`127.0.0.1:<origin-port>`, redirects the apex to the canonical Web host, makes the temporary Gate C
host non-indexable, removes query strings from TikDD access-log request lines, and exposes only the
public API/Delivery routes. Admin, health, diagnostics and internal services are absent, and unknown
Tunnel hostnames fail closed with 404.

Install safely:

1. render into a temporary file and review the diff;
2. install only the TikDD site file atomically;
3. run `nginx -t`;
4. reload Nginx only after validation;
5. regression-test every existing PHP and non-TikDD site.

Phase C2 installs and configures host-level, systemd-managed cloudflared; it is not part of TikDD
Compose and its current absence does not reject the approved VPS. Host cloudflared routes approved
public hostnames to the shared loopback Nginx origin while
preserving the Host header for `server_name` routing. The cloudflared systemd lifecycle and Tunnel
credential remain infrastructure-owned. During migration, existing public 80/443 behavior may stay
available. On the reviewed shared NL host, the Tunnel cutover is TikDD-only: unrelated PHP sites
continue to require public 80/443, so host-wide firewall closure is explicitly outside this phase.
The public TikDD vhost must not proxy the new application after cutover; the new application is
reachable only through the loopback Tunnel origin. TikDD scripts make no firewall change.

The completed NL Gate C uses Tunnel `tikdd-nl` and publishes only `gate-c.tikdd.cc`,
`api.tikdd.cc`, `dl.tikdd.cc`, `www.tikdd.cc` and the apex `tikdd.cc` to
`http://127.0.0.1:8080`, with an explicit per-route Host header and a final 404 rule. The canonical
origin is `https://www.tikdd.cc`; the apex redirects permanently while preserving path and query.
The staging hostname is always non-indexable. Admin, wildcard and private-network routes are
forbidden unless a later reviewed work item explicitly changes that boundary.

## 9. Shared-host resources, logs and disk

The audited host has 3.8 GiB RAM, approximately 1.5 GiB available and active swap use while shared
MySQL, host Redis, about 30 PHP-FPM workers, Nginx, hosting-panel services and three PHP websites are
running. The VPS remains the approved target and no 8 GB or RAM-upgrade prerequisite applies.
Those permanent services remain in every capacity measurement.

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

Reclamation may be credited only after a component is proven `legacy-TikDD-exclusive`. Shared
MySQL, host Redis, shared PHP-FPM, Nginx, the panel and unrelated sites never count as reclaimable.
If pressure appears, keep Admin stopped, keep operational jobs one-shot, hold the stage and review
TikDD-specific concurrency, connection pools and memory behavior. Do not tune or stop shared
services to make TikDD fit.

Docker's bounded local logging defaults to 20 MB × 5 files. Six continuous containers therefore
have a theoretical rotated-log ceiling of about 600 MB; the on-demand Admin pair can add about
200 MB while running. One-shot jobs should be removed after execution. Nginx, system, PHP,
PostgreSQL, Redis AOF, Docker layers and release artifacts still consume the same shared 50 GB disk.

Retain current and previous approved image digests. Remove an older digest only after proving no
active/rollback release references it. Build-cache cleanup must target confirmed cache only. Never
use `docker system prune -a --volumes` as routine maintenance, never include PostgreSQL/Redis volumes
in generic cleanup, and never automatically delete the rollback release.

## 10. Release and rollback

`scripts/production-release.sh deploy` validates Compose, obtains `flock`, requires the stage gate,
applies the backup-or-fresh-empty database gate, pulls immutable minimum-set images, starts each
service in the reviewed order and runs internal preflight. It never starts Admin, stops shared PHP
components, manages host MySQL/Redis/PHP/Nginx/cloudflared, creates rollout rules or grants Provider
traffic. Nginx/Tunnel work remains a separate reviewed host action after coexistence is proven.

Rollback requires `TIKDD_ROLLBACK_ENV` pointing to the previous approved immutable image/config
bundle and an explicit `TIKDD_SCHEMA_COMPATIBILITY_CONFIRMED=true`. It preserves PostgreSQL data,
route-policy/audit history and evidence. It never runs reverse migrations. If the previous
application is incompatible with the current schema, stop and use a forward fix or a coordinated
database restoration under the owner-approved restore procedure.

The old TikDD application is not a rollback path: the owner shut it down and released its runtime
before C2. Gate A/B rollback stops and removes only newly staged TikDD containers while preserving
the new PostgreSQL and Redis data directories for investigation. MySQL, host Redis, shared
PHP-FPM/Nginx/panel and unrelated sites are never eligible for rollback or reclamation.

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

## 12. Phase C2 controlled cutover gates

### Gate A — container staging

Require the reviewed Phase B/C1.1 revision, a fresh host/PHP/MySQL/host-Redis baseline, healthy
Docker, free loopback ports and subnets, proven Secret GID access, immutable images/digests and
complete configuration. Shared MySQL and host Redis remain online.

### Gate B — new-stack coexistence verification

Require healthy TikDD PostgreSQL, TikDD Redis, API, Delivery, Worker and Web; healthy host MySQL,
host Redis and every existing PHP site; no OOM or restart storm; acceptable measured pressure; and
the trusted-proxy `/32` confirmed from actual API socket behavior. Green container health alone is
insufficient.

### Gate C — public ingress cutover

Require systemd cloudflared, reviewed Tunnel/Nginx integration, regression success for every PHP
site and TikDD route, plus a reviewed forward-fix/data-preserving rollback plan for the new stack.
Public 80/443 may remain open. Do not grant Provider allocation at this gate.

### Gate D — legacy TikDD application retirement

This historical C1 gate is superseded. The owner completed legacy TikDD retirement before C2, so
there is no Gate D action and no authority to recreate the old deployment.

Hold any gate on OOM, rapidly growing swap, sustained severe pressure, material PHP degradation,
MySQL/host-Redis/PostgreSQL instability, repeated restarts or unacceptable load. Public 80/443 close
only in a later owner-approved firewall cutover after all hosted sites no longer need direct origin.

## 13. Work Item 17 operational scheduling

Work Item 17 owns recurring execution, last/next-run state, freshness, missed-run detection and
supervision. The repository keeps `canary`, `evidence`, `cleanup` and `cleanup-dry-run` as manual
one-shot operations and adds `canary-scheduled`, `evidence-scheduled` and `cleanup-scheduled`
wrappers that call the existing runtimes. Host units in `deploy/systemd/` are installed by
`scripts/install-operational-timers.sh`; each timer invokes
`scripts/run-scheduled-operation.sh` through the shared `/run/lock/tikdd-deploy.lock` and runs a
Docker Compose `--profile ops run --rm --no-deps` job. No scheduler container or permanent Node
process is introduced, and the host installation never restarts Nginx, cloudflared, PHP-FPM,
MySQL or host Redis.

The `operational_service_status` current read model is authoritative for sanitized scheduler
freshness. Run `pnpm verify:operational-services` to require fresh completed `canary`, `evidence`
and `cleanup` rows without Provider access. Run `scripts/verify-operational-scheduler.sh` on the
host to combine that readiness check with enabled/active timers and next triggers. The scheduled
Canary is separately authorized with `TIKDD_SCHEDULED_CANARY_AUTHORIZED=true`, the exact
`ssstwitter-x-recurring-001` definition and `CANARY_REGION=canary-global`; the manual
`TIKDD_CANARY_AUTHORIZED` flag remains false and public Worker allocation remains zero.
