# Work Item 16 production staging record

## Scope and decision

This record covers Phase C2 Gate A and the attempted Gate B on the approved Netherlands host
`magic` (`linux/amd64`) on 2026-08-30. It stops at Gate B. No Cloudflare/DNS/Nginx public cutover,
firewall closure, Provider traffic, recurring job or Work Item 17 action was performed.

The owner confirmed that the old TikDD deployment had already been shut down and its resources
released. It was not restored or recreated. Although the owner expected one remaining PHP site,
inspection found three active Nginx PHP site configurations, so all three were protected.

## Reviewed release

- Deployed source revision: `161364eb64a566860ceeaac6c7791a23a6cbad6c`.
- Branch at staging: `codex/work-item-16-production-staging`.
- Configuration revision: `c2-b-161364eb-20260830`.
- Deployed Compose SHA-256: `959ec9a461f0434cf4f3316121039f788778735401f8d3e6bb033c6d7a60e387`.
- Release archive SHA-256: `5782c2b7f449a08e82e9c5fae05f22ea9255e73a85770e239734a00c7552f545`.
- `pnpm verify:work-item-16`: passed before deployment and after the Redis correction.
- `pnpm check`: passed after the correction (71 test files, 365 tests, all builds).

Immutable public images:

- Web: `ghcr.io/wepuu/tikdd-web@sha256:a96b09ded708f8ce5d00358b25ade347589452fa1e37b80123ca1127bc9ddfb0`.
- Admin: `ghcr.io/wepuu/tikdd-admin@sha256:97371d82967278d302578f7ae8558aef7a423362e1233037322997bf6a1e9464`.
- Service: `ghcr.io/wepuu/tikdd-service@sha256:83cbd30a6be08f6506b47d9668e6aa5760ae52891f917248f247e72c0f5b2214`.
- PostgreSQL: `postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94`.
- Redis: `redis:7.4.5-alpine@sha256:bb186d083732f669da90be8b0f975a37812b15e913465bb14d845db72a4e3e08`.

Application images reported OCI revision `161364eb64a566860ceeaac6c7791a23a6cbad6c` and source
`https://github.com/wepuu/tikdd`. The VPS pulled the GHCR images without registry credentials after
the packages became public.

## C2 pre-deployment baseline and Gate A

| Measurement | Value |
| --- | ---: |
| CPU | 4 vCPU, x86_64 |
| MemAvailable | 1,967,748 KiB |
| Swap used | 466,996 KiB |
| Load (1 minute) | 0.10 |
| Root disk available | 42,289,588 KiB |

The host has approximately 4 GiB RAM and 2.25 GiB swap. Historical kernel logs contained global
OOM events from 2026-08-26/27, including MySQL victims, but no new OOM event was found after the C2
baseline boundary `2026-08-30 06:45:00 -07:00`.

Gate A verified:

- Nginx valid; PHP-FPM, MySQL and host Redis active; host Redis returned `PONG`.
- `www.greatppt.com` `/` and `/wp-login.php` returned 200; `www.longyanbowuguan.com` `/` returned
  200 and `/wp-login.php` the expected 404; `www.tikdd.cc` `/` and `/wp-login.php` returned 200.
  Each request remained below 3 seconds.
- Loopback ports `3300`, `3301`, `3400` and `3402` were free. No application service bound to
  `0.0.0.0`.
- `172.30.40.0/24` and `172.30.41.0/24` were collision-free.
- Secret-reader GID `1999` was free and created as `tikdd-secrets`.
- `/etc/tikdd/secrets` is `root:1999` mode `0750`; secret files are `root:1999` mode `0440`.
- Native Linux probes proved application identity `1000:1000` and Redis identity `999:1000` could
  read only their mounted secret through GID 1999. No value was printed.
- PostgreSQL data was prepared as `70:70` mode `0700` and Redis as `999:1000` mode `0750`.
  PostgreSQL was confirmed empty before first initialization.
- Compose validated and digest-pinned images were available. After image pull, MemAvailable was
  1,855,196 KiB, swap used 463,924 KiB, load 1.55 and disk available 41,669,936 KiB.

**Gate A: PASS.**

## Gate B stage observations

| Stage | Result | MemAvailable | Swap used | Load (1m) | Disk available | Container memory |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| B1 PostgreSQL | PASS | 1,778,540 KiB | 463,668 KiB | 0.76 | 41,622,936 KiB | 54.72 MiB |
| B2 TikDD Redis | HOLD | not sampled running | not sampled running | — | — | never started |

### B1 PostgreSQL

The fresh PostgreSQL container became healthy, published no host port, used
`/var/lib/tikdd/postgres`, and had zero restarts. Host MySQL, host Redis, Nginx/PHP-FPM and all
protected PHP routes remained healthy. The initialized directory is now non-empty and must never
again use the first-empty-database confirmation path.

### B2 TikDD Redis HOLD

Redis container creation succeeded but OCI startup failed:

```text
exec: "/usr/local/bin/tikdd-redis-entrypoint": permission denied
```

Native Compose reported that local config `uid`, `gid` and `mode` are ignored. The release archive
stores both Redis scripts as non-executable, so invoking the config mount directly was not portable
to the production Linux host. No Redis process started; no migration or application was attempted.

The TikDD-only correction invokes both scripts through `/bin/sh` and adds Work Item 16 static
assertions. It passed `pnpm verify:work-item-16`, `pnpm check` and `git diff --check`. At the HOLD
boundary it had not yet been committed, reviewed, merged, rebuilt or redeployed, and production
remained pinned to the reviewed SHA.

## HOLD rollback and current host state

Progression stopped immediately. The new Redis and PostgreSQL containers were stopped and removed.
PostgreSQL and Redis data directories were preserved; no data was deleted. The post-rollback gate
passed with MemAvailable 1,829,880 KiB, swap used 463,412 KiB, load 0.55 and disk available
41,622,640 KiB.

The `tikdd_data` network remains at `172.30.40.0/24`, gateway `172.30.40.1`. Provider-egress was
never created. Application loopback ports are unused. Host Redis remains independently bound at
`127.0.0.1:6379` and returns `PONG`; Nginx and MySQL remain active.

**Gate B: HOLD at B2; initial shared-host coexistence is not yet verified.**

API never started, so the Nginx-to-API peer and narrow trusted-proxy value were not established.
Migration, runtime roles, API, Delivery, Worker, Web and internal preflight were not run. Admin,
Canary, Evidence and Cleanup remained stopped. Provider flags, rollout and Canary authorization
remained false; no Provider traffic was granted.

## Gate C prerequisites

Before Gate C:

1. commit and review the Redis config-mode correction;
2. merge it and build new immutable images from the new exact SHA;
3. repeat Gate A against that release;
4. restart Gate B from B1, treating PostgreSQL as non-empty and requiring a reviewed backup gate;
5. complete migration, least-privilege roles, API/Delivery/Worker/Web, trusted-proxy measurement,
   internal preflight, PHP regression and bounded stabilization.

Only after Gate B passes may a separate approval configure Cloudflare/Tunnel/public Nginx routes.
Public DNS, ports 80/443, Provider traffic and Work Item 17 remain unchanged.
