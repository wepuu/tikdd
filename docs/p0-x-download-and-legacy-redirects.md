# P0 production stabilization: X download and legacy redirects

Status: Part B deployed; Part A diagnosed but Provider repair remains pending (2026-08-31)

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

The first admitted production task then exposed the corresponding Worker terminal-transition
permission gap: `tikdd_worker` could update a task but could not delete its task-bound
`active_source_admissions` row, so an exhausted job remained `resolving`. The same migration grants
the Worker DELETE only on that active-source table; it does not grant Worker deletion of
idempotency rows or resolve tasks.

That task's sanitized ledger recorded two SSSTwitter attempts in `nl`, both rejected as
`provider_schema_changed` after 1,207 ms and 976 ms. No normalized formats or delivery candidates
were created, so no Delivery ticket or browser download was possible. This is current evidence of
an SSSTwitter response-shape regression, but the authorized task did not retain an upstream payload
and no further Provider submission is authorized by this run.

The only currently valid live tuple is SSSTwitter / X /
`https://x.com/SpaceX/status/2093477720638341395?s=20`. Its checked-in authorization is explicitly
limited to recurring scheduled technical Canary use and does not authorize a production browser
download or rollout. It must not be reinterpreted as broader permission.

The owner granted a one-time maintenance authorization for this exact tuple. The public task-create
route was blocked before any runtime gate changed. Only SSSTwitter was enabled and the existing
rollout control plane admitted the exact `ssstwitter` / `x` / `nl` tuple. The final results are
recorded below; the authorization did not become a public rollout grant.

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

## Controlled X production diagnostic

The maintenance diagnostic ran on the NL deployment after the owner supplied an exact authorization
for SSSTwitter and the reviewed SpaceX URL. It used these controls:

- public `POST /v1/resolve-tasks` returned 503 throughout each active Provider window;
- loopback API access was used only for the owner task;
- the rollout rule ID was exact to SSSTwitter/X/NL and had a 15-minute expiry;
- no other Provider was enabled and no fallback Provider could be selected;
- the existing queue retry, concurrency, timeout, host-policy and delivery boundaries were retained.

The first submission attempt stopped before task creation with `ADMISSION_UNAVAILABLE`. Read-only
inspection proved the API role lacked the DELETE permissions required by its own expired-admission
cleanup. Migration 0019 was merged at Git SHA
`4ad5e0e00ba6108009e56b4056e6da4e0eb9e34d` and applied with SHA-256
`a9b1c83e390589ad3514347e914f60ce2b29c4d7356cb7ded2118da7a8446298`.

After that correction, the one effective diagnostic task was admitted and routed only to
SSSTwitter. Its sanitized attempt ledger contained two bounded Provider attempts:

| Provider | Platform | Region | Result | Duration |
| --- | --- | --- | --- | ---: |
| SSSTwitter | X | NL | `provider_schema_changed` | 1,207 ms |
| SSSTwitter | X | NL | `provider_schema_changed` | 976 ms |

The exhausted job also exposed that the Worker lacked permission to release the task-bound active
source row during its terminal transition. The updated 0019 migration was merged at Git SHA
`aa80eea9c2d3fe94a7bd4a6b2805c0c3f25d7e40` and applied with SHA-256
`7ab4f8df55e69861c4a606c74a0313b812d739cb63c124af82e66f02cc1b8b23`. The stuck task was
atomically set to the same `PROVIDER_UNAVAILABLE` failed state used by the Worker and its active
source admission was removed.

No normalized format, encrypted candidate, Delivery ticket or media response existed, so a browser
download could not be performed. The authorized run did not retain upstream HTML and cannot support
a safe parser change by itself. A further Provider submission must not occur without a new exact
authorization that permits capturing a sanitized minimal response-shape fixture.

Final state:

- rollout rule revision 4 is disabled, allocation 0, and expired;
- SSSTwitter, TwitterSaver and DLPanda runtime flags are false;
- Provider rollout and Canary authorization flags are false;
- public task creation again reaches normal application validation;
- the original production environment and Nginx checksums were restored;
- all six TikDD containers are healthy with zero restarts and the host stage gate passes;
- X is not stable, the X Production Evidence Gate remains open, and Work Item 17 was not started.
