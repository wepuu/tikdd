# Work Item 16 production staging record

## Scope and decision

This record covers Phase C2 Gates A, B and C on the approved Netherlands host `magic`
(`linux/amd64`) on 2026-08-30 and 2026-08-31. Gate B first stopped safely at Redis, then passed on
the reviewed retry. Gate C subsequently moved TikDD's public Web, API and Delivery entry points to
a dedicated Cloudflare Tunnel and loopback-only Nginx origin. No Provider traffic, recurring job,
Admin publication or Work Item 17 action was performed. Public host ports 80/443 remain available
for the unrelated PHP sites on this shared host.

The first two Gate B attempts and their data-preserving HOLD actions are retained below. The final
reviewed retry at SHA `04fd7969d696571b2e90522a1127b33b01daa7fb` passed Gate B; see
“Final reviewed retry” for the authoritative deployed state.

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

## Final reviewed retry

### Release and corrections

PR #7 fixed native-Linux Redis config mounts by invoking the entrypoint and health-check scripts
through `/bin/sh`. PR #8 added a dedicated host-ingress bridge after Docker 29 recorded, but did
not activate, loopback publications for containers attached only to the internal data network.
A bounded temporary probe proved that the new bridge publishes to loopback while
`enable_ip_masquerade=false` prevents it from becoming general outbound egress. Probe resources
were removed before deployment.

- Final Git SHA: `04fd7969d696571b2e90522a1127b33b01daa7fb`.
- Configuration revision: `c2-retry3-04fd7969-20260830`.
- Release archive SHA-256: `adf204cf0925dd98d0ae84f91df4ea6a4db9e2505aa49a0d8f500b652cc14690`.
- Deployed Compose SHA-256: `d4c4650cb77ff5b4d411e716ddb3a7fa586884c486efbd59784b9bacf28d0d80`.
- Web: `ghcr.io/wepuu/tikdd-web@sha256:252dfb2e433bdd1d013f5a8c9251b3268e1112ce193a89788a2c395bd0d9b6ed`.
- Service: `ghcr.io/wepuu/tikdd-service@sha256:95fda2f9effc23045666e2cd3967d1545736c181c4aa8cb2153dfad6f5954fca`.
- Admin: `ghcr.io/wepuu/tikdd-admin@sha256:695dfdb963c01bd16f74e9efdbea257082f73b73c8c70e65a1aaa0c317387962`.

The API initially failed closed because the generated host environment omitted the non-secret
`PILOT_EVIDENCE_DIAGNOSTICS_ACTOR_ID` while its independent token was present. The corrected
production configuration uses `owner.tikdd`; the repository example already contained this key.

### Final Gate A

Gate A passed before and after pulling the final digests. The post-pull snapshot reported
MemAvailable 1,758,628 KiB, swap used 448,252 KiB, one-minute load 1.36 and root disk available
39,830,088 KiB. All protected PHP routes, Nginx, PHP-FPM, MySQL and host Redis remained healthy.
Ports 3300/3301/3400/3402 were free before startup. The final networks are:

- `data`: `172.30.40.0/24`, internal, PostgreSQL/Redis and explicit consumers only;
- `provider-egress`: `172.30.41.0/24`, Worker/Delivery and approved operational consumers;
- `host-ingress`: `172.30.42.0/24`, Web/API, loopback default binding, masquerading disabled.

Secret-reader GID remains 1999. The migration-before-retry backup is
`/var/backups/tikdd/pre-migration-75f76b20.dump`, SHA-256
`26e5aecc1c7c362792c2c5d5643f4ded7d1e146b292b0c0d5237333ba26d42b7`; both checksum and
`pg_restore --list` verification passed. No secret value was logged.

### Final Gate B stages

| Stage | Result | MemAvailable | Swap used | Load (1m) | Relevant observation |
| --- | --- | ---: | ---: | ---: | --- |
| B1 PostgreSQL | PASS | 1,755,600 KiB | 448,252 KiB | 0.95 | healthy, private 5432, backup verified |
| B2 TikDD Redis | PASS | 1,761,316 KiB | 448,252 KiB | 0.88 | authenticated PONG, private 6379, 128 MiB maxmemory |
| B3 migration | PASS | 1,762,360 KiB | 448,252 KiB | 1.05 | migrations 0001–0018 idempotent; six runtime roles verified |
| B4 API | PASS | 1,507,856 KiB | 448,252 KiB | 0.76 | healthy; `127.0.0.1:3400` |
| B5 Delivery | PASS | 1,458,824 KiB | 448,276 KiB | 0.60 | healthy; `127.0.0.1:3402`; no media request |
| B6 Worker | PASS | 1,306,536 KiB | 468,572 KiB | 0.61 | healthy; all Provider/rollout/Canary gates disabled |
| B7 Web | PASS | 1,182,256 KiB | 478,548 KiB | 0.69 | healthy seed content; `127.0.0.1:3300` |

The final bounded stabilization samples all passed. The third gate reported MemAvailable
1,212,064 KiB, swap used 439,068 KiB, one-minute load 0.43 and disk available 40,264,536 KiB.
All six containers had zero restarts and remained healthy. No OOM event was recorded after the C2
baseline. The three protected PHP-site baselines, MySQL, host Redis, PHP-FPM and Nginx passed after
every material stage.

PostgreSQL and TikDD Redis have no host publication. Web, API and Delivery are bound only to
`127.0.0.1`. Admin and Admin API remain stopped; neither 3301 nor 4100 listens. The observed API
socket peer through loopback forwarding was exactly `172.30.42.1`, validating the narrow
`TRUSTED_PROXY_CIDRS=172.30.42.1/32` value.

### Internal preflight and traffic boundary

The first preflight invocation rejected an incomplete `{}` operational-signal object at schema
validation. It was rerun with truthful complete signals. The resulting fail-closed report passed
9 checks and blocked 8: deployment scope/Provider manifests/runtime rollout were disabled,
Provider reachability was intentionally not probed, Cleanup/Evidence freshness was absent, and
emergency-deny propagation was not measured. It issued no attestation.

This blocked X production-evidence decision is expected and does not invalidate application
coexistence. It prevents Provider traffic. The production task count remained zero; no Provider,
media or Canary request occurred.

**Final Gate B: PASS — initial shared-host coexistence verified.**

At the Gate B boundary no public Cloudflare Tunnel, DNS, Nginx route, firewall 80/443 change,
Provider allocation, scheduler or Work Item 17 action had been performed. The old TikDD deployment
was not recreated. The separately approved Gate C execution is recorded below.

## Phase C2-C public ingress cutover

### Reviewed release and origin

PR #10 merged the Tunnel-only ingress configuration before production installation. Gate C uses:

- Git SHA: `df3d45f53527344dcbc0cbd931171df76383f213`;
- configuration revision: `gate-c-df3d45f-20260831`;
- release archive SHA-256: `9b1d94e47d6d4a9ab9ec625804886903c371dd8252f4345d047d05d31b72b889`;
- Nginx origin configuration SHA-256:
  `24e64acaba134b04c7c74c9571f3cdeb55991412ba143a9a724ac3f89afc1e0c`;
- Web image:
  `ghcr.io/wepuu/tikdd-web@sha256:f99584a98e55eb0d790007763c3c642522ae8445b18d747747ba4fc30162349f`;
- Service image:
  `ghcr.io/wepuu/tikdd-service@sha256:142721fb3153d2a5675376b839408d6edd415437e67fa25a91bc3ce172de8cab`;
- Admin image, published but not started:
  `ghcr.io/wepuu/tikdd-admin@sha256:1084640d940d95edebead23429773e619bd097ee1a1caa5d3fa3d0b0c14027ff`.

The rendered TikDD Nginx site listens only on `127.0.0.1:8080`. The existing public-port TikDD
vhost remains a static stop page and does not proxy the new application. Direct public 80/443
therefore cannot reach the new TikDD stack, while the two unrelated PHP sites retain their existing
public-port dependency. Nginx validation and reload passed, and unknown or Admin hostnames return
404 on the Tunnel origin.

### Cloudflare Tunnel

The official Cloudflare package repository installed `cloudflared 2026.8.3`. Host systemd owns a
hardened `cloudflared` service running as the unprivileged `cloudflared` user. Its token file is
`root:cloudflared` mode `0440`; no token value entered logs, the repository or this record. Metrics
listen only on `127.0.0.1:20241`.

- Tunnel name: `tikdd-nl`;
- Tunnel ID: `0aaffd36-8684-4298-baee-a67d572795a4`;
- origin service for every published hostname: `http://127.0.0.1:8080`;
- published hostnames: `gate-c.tikdd.cc`, `api.tikdd.cc`, `dl.tikdd.cc`, `www.tikdd.cc` and
  `tikdd.cc`;
- no Admin hostname, wildcard route or private-network route exists;
- final remote-managed ingress version: 5, followed by a terminal `http_status:404` rule.

The rollout was deliberately ordered: staging, API/Delivery, canonical Web, then apex. Each step
passed before the next DNS route was changed. The connector registered four QUIC connections at
Amsterdam Cloudflare locations and retained `NRestarts=0` through stabilization. ICMP proxy remains
disabled and is not required for the HTTP Tunnel; no broader capability or kernel permission was
granted.

### Public verification

- `https://www.tikdd.cc/en` and `/zh-CN` return 200 with reviewed localized content.
- Canonical, reciprocal `en`/`zh-CN` hreflang and `x-default` all use
  `https://www.tikdd.cc`.
- `robots.txt` points to the canonical sitemap and keeps task, result, delivery, internal and Admin
  paths disallowed. The sitemap contains only the two stable localized homepages.
- A versioned Next.js CSS asset returned 200 with immutable caching.
- `https://tikdd.cc/zh-CN?source=cutover&check=1` returned 301 to
  `https://www.tikdd.cc/zh-CN?source=cutover&check=1`, preserving path and query.
- `https://api.tikdd.cc/v1/platforms` returned 200 and allowed only the canonical Web origin.
- Delivery CORS preflight returned 204. A deliberately invalid ticket returned 410 with
  `no-store` and `noindex`; no ticket or media request was created.
- `gate-c.tikdd.cc/en` remains available with `noindex, nofollow, noarchive`.

### Host gate and stabilization

The host stage gate had been rebaselined after stable observation to a swap baseline of
1,238,460 KiB while retaining the 262,144 KiB maximum-growth bound and 716,800 KiB available-memory
floor. After cutover its obsolete TikDD WordPress checks were replaced with local checks for the
canonical Web, apex redirect, API, Delivery failure boundary, staging noindex and Admin 404. It now
also requires an active zero-restart `cloudflared` service with at least two HA connections. The
two unrelated PHP sites, shared MySQL, host Redis, Nginx/PHP-FPM and all six TikDD containers remain
in the same fail-closed gate. The installed script SHA-256 is
`7a2ae7f07cf27164d3fb97a2b5dff5cdf5913dfc082b2cbd23e9da49b1ffd65a`; the pre-cutover script is
preserved at `/usr/local/sbin/tikdd-stage-gate.pre-cutover-df3d45f`.

| Sample | Result | MemAvailable | Swap used | Load (1m) | Tunnel HA |
| --- | --- | ---: | ---: | ---: | ---: |
| stabilization-1 | PASS | 999,120 KiB | 705,224 KiB | 0.49 | 4 |
| stabilization-2 | PASS | 1,032,308 KiB | 704,968 KiB | 0.54 | 4 |
| stabilization-3 | PASS | 1,091,516 KiB | 704,712 KiB | 0.79 | 4 |

All six containers were healthy with zero restarts in every sample. Swap decreased throughout the
window, no new OOM event appeared after the C2 boundary, and the root disk retained approximately
37.7 GiB available.

**Gate C: PASS — TikDD public ingress is live through the dedicated Tunnel.**

Provider, rollout, scheduled Canary and production-evidence gates remain disabled and fail closed.
Admin remains stopped and unpublished. UFW and public host 80/443 policy were not changed. The
deferred encrypted off-host PostgreSQL backup and proved restore were subsequently closed by
P0-DR-01; Gate C itself did not authorize that work or Work Item 17.
