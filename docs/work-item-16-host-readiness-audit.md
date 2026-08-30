# Work Item 16 Phase C1 — NL production host readiness audit

- Audit date: 2026-08-30
- Audited repository revision: `14ba0fef376ce568ec89eb388a7ac3b33541d25b`
- Source branch at evidence collection: `main`, clean and aligned with `origin/main`
- Deployment identity/region: `tikdd` / `nl`
- Audit mode: owner-operated, read-only host inspection relayed from the production host

This audit is tied to the merged Work Item 16 Phase B revision above. It did not deploy TikDD,
create or start containers, pull images, create directories or networks, run migrations, alter
Nginx, cloudflared, Docker, DNS or firewall state, contact a Provider, or grant rollout traffic.
Public IP addresses, unrelated-site hostnames, credentials and application data are intentionally
not retained in this repository document.

This file preserves the Phase C1 evidence and historical `NOT READY FOR DEPLOYMENT` result. The
later infrastructure-owner decisions in the Phase C1.1 addendum change the remediation plan but do
not rewrite that audit outcome. Operators must read the addendum before using the historical backup,
capacity or deployment-gate statements below.

## 1. Reviewed source and image identities

Phase B expects three application images built for `linux/amd64` from the audited SHA:

| Image role | Required identity for a release | Current state |
| --- | --- | --- |
| Web | `ghcr.io/<approved-owner>/tikdd-web@sha256:<published-digest>` | No approved coordinate or published digest |
| Admin | `ghcr.io/<approved-owner>/tikdd-admin@sha256:<published-digest>` | No approved coordinate or published digest |
| Service | `ghcr.io/<approved-owner>/tikdd-service@sha256:<published-digest>` | No approved coordinate or published digest |
| PostgreSQL | `postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94` | Reviewed Phase B default; not pulled |
| Redis | `redis:7.4.5-alpine@sha256:bb186d083732f669da90be8b0f975a37812b15e913465bb14d845db72a4e3e08` | Reviewed Phase B default; not pulled |
| Build/runtime base | `node:24.14.0-bookworm-slim@sha256:d8e448a56fc63242f70026718378bd4b00f8c82e78d20eefb199224a4d8e33d8` | Reviewed Phase B default; not pulled |

Application tags such as `git-14ba0f...` are discovery labels only. The release manifest and
production environment must use registry digests. `Dockerfile.production` still contains the OCI
source label `https://github.com/example/tikdd`; this is an implementation defect to correct in a
separate reviewed implementation phase before publishing production images.

## 2. Host identity

| Property | Observed | Reference | Assessment |
| --- | --- | --- | --- |
| Hostname | `magic` | not prescribed | Informational |
| Hosting provider | Not locally determinable | NL production host | Owner input remains required |
| Virtualization | Red Hat KVM | virtual server | Compatible |
| Distribution | Ubuntu 24.04.4 LTS | Ubuntu Server 24.04 LTS | Match |
| Kernel | Linux 6.8.0-110-generic | supported Ubuntu kernel | Match |
| Architecture | x86_64 | x86_64 | Match |
| CPU | 4 vCPU, AMD EPYC 7763 | 4 vCPU | Match |
| RAM | 3.8 GiB usable | 4 GB | Expected nominal difference |
| Swap | 2.25 GiB across 256 MiB and 2 GiB files | not prescribed | Present; 381 MiB in use |
| Root disk | 79 GiB ext4 | approximately 50 GB SSD | Larger than reference; storage medium not locally proven |
| Timezone | `America/Los_Angeles` (PDT), NTP synchronized | NL deployment | Difference; services must continue using UTC timestamps |
| Uptime | 134 days at collection | not prescribed | Stable, but also indicates long-lived shared workload |

The public interface has one routed IPv4 `/24` and link-local IPv6 only. No VPN, Tailscale or other
private routed interface was present in the captured route inventory. The hosting provider and
physical storage class cannot be inferred from KVM/DMI evidence alone.

## 3. Resource baseline and capacity gate

At collection time the host reported 3.8 GiB total RAM, 2.4 GiB used, approximately 296 MiB free,
1.6 GiB page cache and 1.5 GiB available. Swap usage was approximately 381 MiB. Load averages were
`0.27 / 0.39 / 0.62`; a one-shot CPU sample was 97.7% idle with no I/O wait.

The root filesystem used 33 GiB of 79 GiB (44%) and had 43 GiB available. Material consumers were:

- `/www/wwwroot`: 13 GiB;
- `/www/wwwlogs`: 6.0 GiB;
- `/www/server`: 5.7 GiB;
- `/var/log`: 1.5 GiB, including approximately 1.2–1.3 GiB of system journal;
- `/www/backup`: 291 MiB;
- `/var/lib`: 252 MiB before TikDD.

The shared production workload includes approximately 30 PHP-FPM 8.2 workers plus a master,
MySQL, host Redis, Nginx, the BT Panel control process, an MTA-STS daemon, SSH and Docker. MySQL
reported about 277 MiB RSS. Individual PHP-FPM workers reported roughly 190–211 MiB RSS, although
their shared mappings make a simple RSS sum unsuitable as a physical-memory total; the host-wide
`available` value is the capacity authority.

**Resource gate: PASS WITH CONSTRAINTS.** The Phase B smoke's approximately 722 MiB idle foundation
without Admin could fit inside the observed 1.5 GiB available headroom, but the reviewed continuous
hard-cap envelope of about 2.06 GiB does not. Existing swap use and a large PHP worker pool make a
full simultaneous start unsafe without a staged memory observation. Admin must remain on demand,
initial application limits must not be raised, and later deployment must stop if host available
memory, swap-in/swap-out activity, PHP latency or OOM state degrades. This resource gate alone does
not authorize container staging.

## 4. Docker baseline

| Item | Observed state |
| --- | --- |
| Docker Engine | Community 29.7.2, API 1.55, linux/amd64 |
| Docker Compose | v5.5.0 |
| Storage driver/root | `overlayfs`, `/var/lib/docker` |
| Default logging | `json-file` |
| Security options | AppArmor, default seccomp and cgroup namespaces |
| Containers/images/volumes/cache | None |
| Daemon configuration | `/etc/docker/daemon.json`, root-owned mode `0644`; no global change was made or approved |
| Registry authentication | No root Docker client config |
| Networks | default `172.17.0.0/16`; BT Panel `baota_net` at `172.18.0.0/16` |

Docker currently hosts no unrelated container workload, but `baota_net` is shared infrastructure
and must not be removed or repurposed. TikDD must use its own Compose project and named networks;
it must not alter the daemon, default bridge, logging defaults, global cleanup behavior or volume
lifecycle. Phase B Compose is structurally compatible with the host, subject to explicit subnet,
secret-permission and native-Linux Compose validation before any start.

## 5. Port inventory

Observed listeners included:

| Bind | Owner/use | Consequence |
| --- | --- | --- |
| `0.0.0.0:22` and `[::]:22` | SSH | Existing administration path |
| `0.0.0.0:80` | Nginx | Public direct-origin HTTP remains active |
| `0.0.0.0:443` | Nginx | Public direct-origin HTTPS remains active |
| `0.0.0.0:888` | Nginx/phpMyAdmin site | Existing BT Panel-managed listener |
| `0.0.0.0:18869` | BT Panel | Existing control-panel listener |
| `*:3306` | MySQL | Wildcard listener; UFW did not show an explicit 3306 allow rule |
| `127.0.0.1:6379` | Existing host Redis | No conflict with private container Redis |
| `127.0.0.1:8461` | MTA-STS daemon | Existing local listener |

No PostgreSQL listener and no listener in the inspected 3000–3500 or 4000–4200 application ranges
was present. The selected TikDD publications remain:

```text
127.0.0.1:3300 -> Web 3000
127.0.0.1:3301 -> Admin 3001
127.0.0.1:3400 -> API 4000
127.0.0.1:3402 -> Delivery 4002
```

These ports were free at audit time. They must be checked again immediately before staging and
must never be changed to a wildcard or public bind. PostgreSQL and container Redis remain
unpublished.

## 6. Nginx state

The host uses a BT Panel-built Nginx 1.28.3 with HTTP real-IP support. Its prefix and primary
configuration are `/www/server/nginx` and `/www/server/nginx/conf/nginx.conf`. The primary file
includes `/www/server/panel/vhost/nginx/*.conf`; site-specific extensions, redirects, rewrites,
certificates and logs also live below `/www/server/panel/vhost`. Three public PHP site server blocks
listen on both 80 and 443. Certificate files are BT Panel-managed. Access logs live under
`/www/wwwlogs` and currently consume about 6.0 GiB.

`nginx -t` passed. The generated systemd compatibility unit reports `active (exited)` while Nginx
master/workers are running, so a future change procedure must use the host's BT Panel/Nginx
lifecycle rather than assuming a conventional long-running systemd unit.

No active `set_real_ip_from` or `real_ip_header` directive was observed in the selected effective
configuration output. The Phase B template therefore needs host-specific adaptation rather than
blind installation. The safest future location is a dedicated, reviewed file such as
`/www/server/panel/vhost/nginx/tikdd-origin.conf`, because it is already included by the host
configuration. It must not overwrite the existing `www.tikdd.cc.conf`; BT Panel persistence and
rewrite behavior must be verified before installation. Port `127.0.0.1:8080` was free and remains
the recommended shared Tunnel-origin listener.

## 7. Existing PHP site regression boundary

The existing application path is presently:

`public 80/443 -> BT Panel Nginx server_name -> PHP-FPM 8.2 Unix socket /tmp/php-cgi-82.sock`.

The inventory contains the current WordPress site at `tikdd.cc`/`www.tikdd.cc` and two unrelated
PHP sites. Their names remain available in host configuration but are omitted here to avoid
publishing unrelated-site ownership in the repository. Direct-origin 80/443 access remains enabled;
the audit did not inspect DNS or assert that Cloudflare proxying is enabled for every hostname.

The minimum later regression set, run before and after any Nginx/Tunnel change, is:

1. request each of the three site homepages by its canonical hostname and verify its expected
   status, redirect chain, certificate and representative title/body marker;
2. request one non-mutating dynamic PHP route per site; for WordPress, use a GET of the login page
   or another known dynamic content page without submitting credentials;
3. verify static assets and PHP responses retain their expected Host and HTTPS scheme behavior;
4. verify both the Tunnel path and, until the approved cutover, the current direct-origin path;
5. perform no login, checkout, content edit or other state-changing application action.

## 8. cloudflared state and origin listener

No `cloudflared` binary, service unit, running process or locally visible configuration was found.
There is therefore no host-level Tunnel version, credential path, ingress model, restart policy or
local Nginx target to record. The currently approved `cloudflared -> loopback Nginx` path does not
exist on this host.

Because the server already hosts three sites, the operationally simplest future model remains one
host-level, systemd-managed shared Tunnel whose public hostnames all target the same
`http://127.0.0.1:8080` Nginx listener with Host preservation. A separate TikDD-only Tunnel is not
justified by current evidence and would not solve the existing sites' later 80/443 closure gate.
Tunnel installation, credentials, routes and testing require a separate approved infrastructure
change; none occurred during this audit.

## 9. Firewall state

UFW is active with default deny incoming, allow outgoing and deny routed. Public inbound rules
currently allow 22, 80, 443 and several BT Panel/FTP-related ports on IPv4 and IPv6. Nftables
confirmed the UFW input drop policy and the explicit 80/443 accepts. Provider firewall/security
group state was not locally determinable. No Docker-published port existed at audit time.

The future migration sequence remains:

`current public 80/443 -> configure and verify every hosted site through Tunnel -> verify alternate origin access is no longer required -> infrastructure-owner-approved firewall cutover -> close public 80/443`.

The host is not ready for that cutover. Every existing site, BT Panel dependency and certificate
renewal path must first be accounted for. TikDD scripts must not modify these rules.

## 10. Trusted proxy recommendation

TikDD's API disables Fastify's unrestricted proxy trust. Its admission resolver trusts
`X-Forwarded-For` only when the socket peer belongs to `TRUSTED_PROXY_CIDRS`, rejects ambiguous
chains and otherwise uses the socket peer. The intended production chain is:

`Cloudflare -> host cloudflared on loopback -> Nginx real-IP normalization -> 127.0.0.1:3400 Docker publication -> API`.

The API's socket peer will be the gateway address of its Docker `data` bridge, not Nginx's
`127.0.0.1`. Because Phase B Compose currently lets Docker allocate that subnet dynamically, the
exact production peer does not yet exist and must not be guessed from `docker0` or `baota_net`.

Adopt the explicit `data` subnet recommended below, then use the candidate
`TRUSTED_PROXY_CIDRS=172.30.40.1/32`. Phase C2 must observe the API socket peer through a sanitized
local diagnostic and prove it is exactly that gateway before accepting forwarded client identity.
If it differs, use the observed single gateway `/32`; never use `0.0.0.0/0`, `172.16.0.0/12` or a
whole Docker `/16`. Nginx must discard caller-supplied forwarding values and emit one normalized
client value.

## 11. Docker network recommendation

The host routes only its public `/24`, link-local IPv6, `172.17.0.0/16` and `172.18.0.0/16`; no VPN
or Tailscale interface was observed. Reserve these non-overlapping, narrowly sized subnets:

| TikDD network | Recommended subnet | Gateway |
| --- | --- | --- |
| `data` | `172.30.40.0/24` | `172.30.40.1` |
| `provider-egress` | `172.30.41.0/24` | `172.30.41.1` |

Phase B Compose has no `ipam` declaration, so this recommendation requires a separately reviewed
implementation correction before deployment. Re-check host routes and Docker networks immediately
before creation. TikDD must not attach services to `bridge` or `baota_net`, and must never remove
networks it did not create.

## 12. PostgreSQL and Redis storage

`/var/lib/tikdd`, `/var/lib/tikdd/postgres` and `/var/lib/tikdd/redis` do not exist. Their parent
`/var/lib` is root-owned mode `0755` on the persistent root ext4 filesystem with 43 GiB available.
The Phase B paths are suitable in principle and preferable to `/www`, which is owned by the existing
BT Panel/PHP workload and already holds 26 GiB.

Before staging, create the exact parent and datastore directories only through an approved host
change, assign ownership compatible with the pinned PostgreSQL/Redis image UIDs, and verify
permissions from inside one-shot containers. Capacity monitoring and backup must include PostgreSQL;
Redis AOF needs persistence and disk monitoring but is not a substitute for PostgreSQL backup.
Shared-root placement means an application/log growth event can still affect both sites and TikDD.

## 13. Backup readiness

A `zhaoniu-backup-archive.timer` ran approximately every 15 minutes at collection time, and
`/www/backup` held about 291 MiB. This proves only that an existing archive job is scheduled. It
does not prove that TikDD PostgreSQL will be captured consistently, stored off-host, encrypted,
retained for an approved period or restorable. Target type, encryption, retention, restore
procedure and last restore test were not safely determinable without inspecting potentially
sensitive owner configuration.

**BLOCKER BEFORE PRODUCTION MIGRATION:** the infrastructure owner must provide a reviewed off-host
PostgreSQL backup design, a non-secret backup reference usable by `TIKDD_BACKUP_VERIFY_COMMAND`,
frequency/retention, a documented restore procedure and evidence of a successful restore test. The
existing timer cannot satisfy the release gate by name or schedule alone.

## 14. Registry readiness

GHCR is not yet approved by recorded owner input. The host has no root Docker authentication file,
and no TikDD images have been pulled. Candidate coordinates based on repository ownership may be
proposed later, but this audit does not treat them as approved.

Before staging, the owner must approve the GHCR namespace and exact web/admin/service repository
names, publish amd64 images from the audited source, record immutable digests, choose a least-
privilege pull-only credential, and store it in a root-owned host credential location without
placing it in Git or `production.env`. No authentication was attempted.

## 15. Hostname readiness

The existing WordPress site serves `tikdd.cc` and `www.tikdd.cc`. Work Item 16 proposes, but does
not finalize, Web canonical-host policy plus `api.tikdd.cc`, `dl.tikdd.cc` and `admin.tikdd.cc`.
The current redirect include was not opened, so this audit does not claim whether apex or `www` is
canonical.

Owner approval remains required for the Web canonical hostname and all three service hostnames.
Those exact values are build inputs for Web, runtime origins for API/Delivery/Admin, Nginx
`server_name` values and future Tunnel public-hostname routes. They must be fixed before application
image publication; DNS was not modified or administratively inspected.

## 16. Secret-path readiness

`/etc/tikdd` and `/etc/tikdd/secrets` do not exist. The reviewed design intends a root-owned `0700`
directory and root-owned `0400` files. Application images run as the image's unprivileged `node`
user, while Compose file-backed secrets do not currently declare a UID/GID mapping. Native-Linux
readability of root-only source files by UID 1000 therefore cannot be accepted from the Docker
Desktop smoke result.

This is a deployment-blocking implementation/documentation compatibility gap. Phase C2 must prove
the behavior on Linux and adopt a reviewed least-privilege model—for example a dedicated host group
with read-only group access plus explicit container supplemental-group mapping, or another Docker-
supported secret materialization method. Do not make the directory world-readable and do not place
secret values in environment or repository files. No secret directory or value was created here.

## 17. Production configuration gap matrix

| Input | Expected | Actual | Status | Action before deployment |
| --- | --- | --- | --- | --- |
| Audited SHA | Exact reviewed commit | `14ba0fef376ce568ec89eb388a7ac3b33541d25b` | PASS | Bind image labels, manifests and config to this SHA |
| Loopback ports | 3300, 3301, 3400, 3402 on `127.0.0.1` | Free at audit time | PASS WITH RECHECK | Recheck immediately before Compose start |
| Nginx origin | Loopback HTTP listener | No Tunnel origin; `127.0.0.1:8080` free | BLOCKED | Add reviewed BT Panel-compatible site file in later change |
| Trusted proxy | Exact observed Docker gateway `/32` | Dynamic network does not yet exist | BLOCKED | Add explicit IPAM, observe peer, then use candidate `172.30.40.1/32` |
| Docker networks | Isolated `data` and `provider-egress` | Only `172.17/16` and BT `172.18/16`; Compose IPAM absent | BLOCKED | Reserve `172.30.40.0/24` and `172.30.41.0/24` in reviewed implementation |
| Data paths | `/var/lib/tikdd/postgres`, `/var/lib/tikdd/redis` | Absent; parent persistent ext4 has 43 GiB free | PENDING | Create with pinned-image UID ownership after backup approval |
| Registry coordinates | Approved GHCR owner and three repositories | Placeholder coordinates only | BLOCKED | Owner approval and image publication required |
| Image references | Three app digests plus reviewed datastore digests | App digests unavailable | BLOCKED | Build amd64, scan/verify and record immutable digests |
| OCI metadata | Actual GitHub source repository | `example/tikdd` label in Dockerfile | DEFECT | Correct in a separate reviewed implementation change |
| Public domains | Final Web/API/Delivery/Admin hosts | Web site exists; canonical and service names unapproved | BLOCKED | Owner finalizes all four origins before build |
| Secret files | Least-privilege readable mounts | Directory absent; root `0400` design conflicts with unprivileged UID assumption | BLOCKED | Resolve and prove native-Linux UID/GID model |
| Database DSNs | Separate migration/runtime/content identities in secret files | Not provisioned | BLOCKED | Create roles/DSNs only after backup gate; never print values |
| Redis configuration | Private container Redis with auth/AOF/no-eviction | Existing host Redis is unrelated; TikDD Redis absent | PENDING | Keep private and use dedicated secret-backed URL |
| Backup hook | Reviewed off-host encrypted backup and restore test | Unverified archive timer only | BLOCKER BEFORE MIGRATION | Define target, retention, restore and verification command |
| Nginx config location | TikDD-only file without replacing PHP sites | BT Panel include root identified | PENDING | Use dedicated included file and validate with `nginx -t` |
| cloudflared routing | Host service to loopback Nginx | Binary/service/config absent | BLOCKED | Install/configure under separate infrastructure approval |
| Firewall cutover | Close 80/443 only after all sites use Tunnel | 80/443 publicly allowed | DEFERRED | Preserve now; later test all sites then approve closure |
| Resource headroom | Shared workload plus bounded TikDD | 1.5 GiB available, 381 MiB swap used | PASS WITH CONSTRAINTS | Stage incrementally and stop on pressure/regression |
| Production env/release manifest | Root-owned reviewed values and exact digests | Not created | BLOCKED | Render only after all owner inputs are resolved |

## Phase C1.1 subsequent owner decisions

After this audit, the infrastructure owner fixed the following production constraints:

- this audited NL VPS remains the approved production target; another VPS and an 8 GB RAM upgrade
  are not first-deployment prerequisites;
- host MySQL, host Redis, shared Nginx/PHP-FPM/panel services and unrelated websites are permanent
  shared infrastructure and remain online at every stage;
- private TikDD PostgreSQL and TikDD Redis containers intentionally coexist with those shared
  datastores; neither host datastore is reused, retired or counted as reclaimable memory;
- only a component proven `legacy-TikDD-exclusive` may later be stopped, and it is retained—not
  deleted—through the initial rollback-confidence period;
- missing off-host PostgreSQL backup no longer blocks creation/migration of the first proven-empty
  database. It becomes P0 hardening before the post-cutover production posture is accepted; the
  existing MySQL/site archive timer remains unrelated evidence;
- cloudflared installation is a Phase C2 preparation action on this approved VPS, not a reason to
  reject the host;
- Admin remains on demand and operational jobs remain one-shot.

The effective Phase C2 strategy is staged coexistence: baseline; PostgreSQL; TikDD Redis; migration;
API; Delivery; Worker; Web; then public ingress. A read-only stage gate checks RAM, swap growth,
load, OOMs, restarts, disk, all PHP sites, MySQL, host Redis and TikDD health after every significant
step. Gate A covers container staging, Gate B coexistence, Gate C Tunnel/Nginx cutover and Gate D
retirement of only proven legacy-TikDD-exclusive resources. The detailed current procedure is in
[the production deployment runbook](production-deployment.md).

These decisions remove backup and hardware-upgrade assumptions from the initial-empty-database
remediation path. They do not make the host ready today: images, registry, configuration, Secret
GID proof, stable IPAM/trusted-proxy observation and cloudflared/Nginx integration are still pending.

## 18. Historical C1 blockers and implementation findings

At the time of Phase C1, the following conditions blocked a controlled TikDD deployment. Phase C1.1
subsequently changed the first-empty-database backup prerequisite and fixed the same-host target;
use its addendum and the current runbook for remediation ordering:

1. host-level cloudflared and its shared loopback origin do not exist;
2. no reviewed off-host PostgreSQL backup/restore path exists;
3. GHCR namespace, pull authentication and application image digests are unresolved;
4. production hostnames and canonical Web policy are not finalized;
5. native-Linux secret readability for unprivileged containers is unresolved;
6. Compose lacks explicit, non-conflicting IPAM, preventing a stable exact trusted-proxy `/32`;
7. the shared 4 GB host has constrained memory headroom and existing swap use;
8. the BT Panel-specific Nginx/Tunnel integration and all three PHP-site regression tests are not
   yet implemented or observed;
9. datastore identities, secret files and release configuration do not exist;
10. the production Dockerfile's OCI source label still points to an example repository.

The wildcard MySQL listener and broadly allowed BT Panel/FTP-related firewall ports are existing
infrastructure observations, not TikDD changes. The owner should review them separately, but this
audit does not alter or make a vulnerability determination about those services.

## 19. Historical C1 deployment recommendation and independent gates

| Gate | Current decision | Reason |
| --- | --- | --- |
| Safe to stage containers | No | App images/registry, secret UID/GID and explicit subnets are unresolved; memory requires an incremental plan |
| Safe to run migrations | No | Off-host backup and tested restore path are hard prerequisites |
| Safe to expose through Nginx/Tunnel | No | cloudflared is absent and shared-site cutover/regression work is incomplete |
| Safe to enable Provider traffic | No | Work Item 16 grants no Provider authorization or rollout; infrastructure readiness cannot grant either |

At the Phase C1 evidence point, the host matched the CPU/OS architecture and had sufficient disk,
Docker was installed, Nginx was
valid, and the selected loopback application ports were available. Those positives made remediation
practical, but did not overcome the then-unresolved backup, ingress, identity, network, secret and
resource gates. Complete the current Phase C1.1 gates as separately reviewed Phase C2 inputs; do not
begin Work Item 17.

### NOT READY FOR DEPLOYMENT

This was the Phase C1 classification for the audited source revision. Phase C1.1 preserves it as a
historical result while replacing its future remediation semantics with the same-VPS staged
coexistence plan above. No Phase C1.1 documentation change itself authorizes container staging,
ingress cutover or Provider traffic.
