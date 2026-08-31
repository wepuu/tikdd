# P0 production stabilization: X download and legacy redirects

Status: in progress (2026-08-31)

This record covers P0-FUNC-01 and P0-MIG-01. It does not authorize Work Item 17,
recurring operational jobs, broad Provider traffic, or closure of the X Production Evidence Gate.

## X failure classification

The primary failure category is **no eligible route**. The failure occurs in production Provider
selection before any Provider request is sent.

Read-only production inspection found:

- the TwitterSaver, DLPanda and SSSTwitter runtime enable flags are false;
- Provider rollout is disabled and no X/`nl` rollout rule is published;
- no X/`nl` qualification review, guard projection, route policy or Canary measurement exists;
- no X task or Provider attempt was recorded in the inspected production history;
- the circuit and health layers therefore have no selected Provider to evaluate.

The existing build passed deterministic X adapter, routing, candidate encryption/storage and
Delivery tests. There is no current evidence of a parser, normalized-result, candidate or Delivery
regression. No adapter, router or Delivery code was changed.

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

The final production verification and Git identifiers will be appended after deployment. X must
not be marked stable, and Work Item 17 must remain untouched.

The first production candidate was rejected safely by `nginx -t` because the host's map hash could
not hold the longest explicit legacy slug. A second candidate that attempted to override the hash
bucket in the TikDD include was also rejected as a duplicate directive. Both guarded installs
restored the previous configuration before any reload. To avoid changing shared Nginx global
settings, the allowlist now uses one anchored regex per reviewed slug; it remains explicit and does
not introduce a wildcard catch-all. The replacement candidate must pass the same full validation
sequence.
