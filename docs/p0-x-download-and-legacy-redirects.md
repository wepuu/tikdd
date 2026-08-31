# P0 production stabilization: X download and legacy redirects

Status: Part B deployed; Part A awaiting explicit owner authorization (2026-08-31)

This record covers P0-FUNC-01 and P0-MIG-01. It does not authorize Work Item 17,
recurring operational jobs, broad Provider traffic, or closure of the X Production Evidence Gate.

## X failure classification

The initial primary failure category was **no eligible route**. After the owner authorized a bounded
maintenance diagnostic and the route was enabled behind a public-submit maintenance block, the
first loopback submission exposed a second independent blocker: **task-admission database
permission failure**. The production `tikdd_api` role lacked `DELETE` on the two digest-only
admission tables even though `TaskAdmissionRepository` deletes expired rows before admission.
The request returned `ADMISSION_UNAVAILABLE` before task creation; the task table remained empty and
no Provider was called.

Read-only production inspection found:

- the TwitterSaver, DLPanda and SSSTwitter runtime enable flags are false;
- Provider rollout is disabled and no X/`nl` rollout rule is published;
- no X/`nl` qualification review, guard projection, route policy or Canary measurement exists;
- no X task or Provider attempt was recorded in the inspected production history;
- the circuit and health layers therefore have no selected Provider to evaluate.

The existing build passed deterministic X adapter, routing, candidate encryption/storage and
Delivery tests. There is no current evidence of a parser, normalized-result, candidate or Delivery
regression. No adapter, router or Delivery code was changed.

Migration `0019_task_admission_api_delete_grants.sql` grants `tikdd_api` only the two missing
`DELETE` permissions. It does not grant deletion of resolve tasks or any insert, update, truncate,
role-management or schema privilege. The migration is repeatable and a no-op in environments where
the separately provisioned production role does not exist.

The only currently valid live tuple is SSSTwitter / X /
`https://x.com/SpaceX/status/2093477720638341395?s=20`. Its checked-in authorization is explicitly
limited to recurring scheduled technical Canary use and does not authorize a production browser
download or rollout. It must not be reinterpreted as broader permission.

The required next owner action is a separate, explicit one-time maintenance authorization for this
exact tuple. The maintenance procedure must block new public resolve submissions, enable only
SSSTwitter through the existing control plane for the bounded diagnostic, submit one owner-directed
request, create and redeem one Delivery ticket, capture only sanitized evidence, restore zero
allocation and then reopen submissions. Until that authorization is granted, production allocation
remains zero and the controlled live-test result remains pending.

## Legacy redirect policy

The redirect is implemented at the host Nginx layer because it is deterministic and requires no
application state. It is intentionally not duplicated in the Next.js Web application.

The exact recognized route families are:

- `^/i(?:/[^/]+)?/?$` for the historical opaque result route, including `/i` and `/i/`;
- 108 evidence-derived, published, first-level WordPress slugs, each expressed as an individually
  anchored regex with an optional trailing slash in the explicit Nginx map.

The allowlist came from the retained old TikDD WordPress database and historical access-log shapes.
It is stored in `deploy/nginx/tikdd.conf.template`. A universal first-level wildcard is forbidden.

Both canonical `www` and apex requests return one direct `301` to
`https://www.tikdd.cc/`. The obsolete path and query string are dropped. Fragments are not visible
to the server. Current locale routes, platform landing pages, task/result routes, robots, sitemap,
static assets, internal paths and unknown future routes do not match the map.

## Verification and release procedure

Completed offline:

- `pnpm test:p0-stabilization`: 9 files, 86 tests passed;
- `pnpm verify:work-item-16`: passed;
- `pnpm check`: 72 files, 368 tests passed, including type checks and production builds;
- `git diff --check`: passed before documentation was added.

Before the Nginx-only production release:

1. render the template for the existing loopback ports and hostnames;
2. back up the current TikDD Nginx site configuration;
3. run `nginx -t` and stop on any error;
4. reload Nginx without restarting host MySQL, host Redis, PHP-FPM or unrelated sites;
5. verify representative allowed legacy paths, `/i` variants, trailing slashes and query removal;
6. verify `/`, localized routes, platform routes, robots, sitemap, assets and an unknown path do
   not receive the legacy redirect;
7. run the existing TikDD host gate and recheck the unrelated PHP homepage, dynamic PHP route,
   PHP-FPM, MySQL and host Redis;
8. retain the backed-up site configuration as the immediate redirect rollback.

X must not be marked stable, and Work Item 17 must remain untouched.

The first production candidate was rejected safely by `nginx -t` because the host's map hash could
not hold the longest explicit legacy slug. A second candidate that attempted to override the hash
bucket in the TikDD include was also rejected as a duplicate directive. Both guarded installs
restored the previous configuration before any reload. To avoid changing shared Nginx global
settings, the allowlist now uses one anchored regex per reviewed slug; it remains explicit and does
not introduce a wildcard catch-all. The replacement candidate must pass the same full validation
sequence.

## Production redirect release

- merged Git SHA: `565b6a9ba4af0e4fbaf75ceab6b3a2ae885a5411`;
- rendered Nginx configuration SHA-256:
  `151874488389e5a2e8e426c247420b10947c8459bc757b30516bf83680045139`;
- previous configuration backup:
  `/root/tikdd-origin.conf.pre-p0-565b6a9-20260831`, SHA-256
  `24e64acaba134b04c7c74c9571f3cdeb55991412ba143a9a724ac3f89afc1e0c`;
- `nginx -t`: passed before reload; Nginx remained active after reload;
- existing host stage gate: passed with all six TikDD containers healthy and at zero restarts;
- GreatPPT homepage and `wp-login.php`: 200; PHP-FPM, MySQL and host Redis processes remained
  running;
- the owner confirmed that Longyan is an already unavailable site and excluded it from this release
  gate. Its loopback Nginx vhost retained the previously expected homepage 200 and login-path 404.

Public redirect verification:

| Request | Result |
| --- | --- |
| `www /i/legacy-value?utm_source=legacy` | 301 to `https://www.tikdd.cc/` |
| `www /i/` | 301 to `https://www.tikdd.cc/` |
| `www /ok-ru-video-downloader/` | 301 to `https://www.tikdd.cc/` |
| `apex /how-to-use-tikdd-to-download-videos?utm_source=legacy` | one-hop 301 to `https://www.tikdd.cc/` |
| `www /en`, `www /zh-CN` | 200, no legacy redirect |
| `www /en/youtube` | existing 404, no legacy redirect |
| `www /arbitrary-new-page-p0` | 404, no catch-all redirect |
| `www /robots.txt`, `www /sitemap.xml` | 200 with canonical `www` URLs and existing index boundaries |
| `api /v1/platforms` | 200 |
| invalid Delivery path | safe 404; no ticket or media request created |

The production Provider flags, terms gates, rollout, Pilot Guard requirement and Canary
authorization remain false. No X request, Provider request, candidate, Delivery ticket, media
request or broad allocation was created by this release. The controlled X browser diagnostic is
still pending the explicit owner action described above, so P0-FUNC-01 is not complete and the X
Production Evidence Gate remains open.
