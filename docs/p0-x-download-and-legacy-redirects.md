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

### P0-X-HTTP-01 corrected root cause

The historical TikDD production observation above is unchanged: the bounded NL task selected
SSSTwitter but produced no candidate. The subsequent inference that NL region, CDN locality or the
numeric age of the Provider-issued `ts` value caused that outcome is superseded by controlled
owner-operated HTTP A/B evidence.

From the same NL host, the public workflow without a browser-compatible User-Agent returned HTTP 200
and a zero-byte resolve body. Adding only a browser-compatible User-Agent produced a non-empty
`/result_normal?en` response with `#result` and candidate host `ssscdn.io`. A second NL test removed
`Accept-Language` while retaining the User-Agent and still succeeded. `ts` remains an opaque form
value; TikDD does not infer freshness or CDN health from its numeric representation.

The owner separately proved cross-network direct CDN handoff with a one-byte Range request that
returned HTTP 206 and a valid Content-Range. No signed candidate URL is recorded here and that test
must not be repeated by this hotfix. The corrected architecture conclusion is that no US egress,
proxy or TikDD media relay is required. The repair is limited to a fixed browser-compatible
User-Agent on the SSSTwitter landing GET and resolve POST; public rollout remains disabled, X stays
non-stable, the Production Evidence Gate remains open and Work Item 17 is not started.

### P0-X-HTTP-01 v2 production result

The narrow User-Agent change was implemented in commit `d448fdc`, merged as
`251b02b39c66cc949a299f9f24c7c9533bb85d73`, and published in the immutable Service image
`ghcr.io/wepuu/tikdd-service@sha256:6f8d237ee1af9b64f0a2e14bb7593562b43d335e3807aa221c90bc2e35f6da72`.
Only API, Worker and Delivery were replaced. The owner explicitly approved this minimum replacement
after the internal-observation preflight correctly rejected the ordinary production/public,
Provider-disabled state; the host stage gate, health checks, immutable release identity, verified
PostgreSQL backup and automatic rollback boundary remained active. Nginx, Cloudflare, Web and
datastore topology were unchanged.

One effective post-deploy maintenance task used only the authorized SSSTwitter/X/NL/SpaceX tuple.
Its sanitized task ID was `tsk_216ff5607b3243c2aabb72c04ae8d024`. Public task creation was blocked
at Nginx during the Provider window, while the owner task entered through loopback. The deployed
adapter contained the reviewed Chrome 152 User-Agent on both SSSTwitter requests, but the production
result did **not** reproduce the standalone HTTP A/B success:

| Provider | Platform | Region | Result | Duration |
| --- | --- | --- | --- | ---: |
| SSSTwitter | X | NL | `provider_schema_changed` | 1,265 ms |
| SSSTwitter | X | NL | `provider_schema_changed` | 972 ms |

The task ended `PROVIDER_UNAVAILABLE` with zero normalized formats, zero delivery candidates and zero
Delivery tickets. Consequently no Delivery redemption or 302 occurred, no redirect was followed,
and TikDD transferred no media body. The public result exposed no signed candidate URL. No upstream
body was retained, so this run does not justify a parser redesign or a new request-shape hypothesis.
The owner authorization was consumed by this task; no additional Provider request was made.

The standalone A/B evidence still proves that omission of a browser-compatible User-Agent is a real
SSSTwitter request-compatibility defect. This production result proves that adding that header was
not sufficient to repair the current TikDD production path. P0-X-HTTP-01 therefore remains open and
must return to deterministic, sanitized evidence collection under a separately authorized task
before any further adapter change.

Restoration completed with rollout rule revision 6 disabled, allocation 0 and expired. SSSTwitter,
TwitterSaver, DLPanda, rollout and Canary flags are false; the public task endpoint again reaches
normal validation and returned 400 for an invalid request. All six production containers are
healthy with zero restarts, and the final host stage gate passed. X remains non-stable, the X
Production Evidence Gate remains open, no US egress/proxy/media relay was introduced, and Work Item
17 was not started.

### P0-X-EVIDENCE-01 isolated production-image capture

On 2026-09-01, a bounded differential capture ran from repository baseline
`41a4c147f87365a712e2900cbe6cf87bbf040d5f` against the unchanged production application SHA
`251b02b39c66cc949a299f9f24c7c9533bb85d73`. It used the immutable Service image
`ghcr.io/wepuu/tikdd-service@sha256:6f8d237ee1af9b64f0a2e14bb7593562b43d335e3807aa221c90bc2e35f6da72`
and its Node `v24.14.0` runtime on the NL production host. Read-only inspection of the current
Worker, retained Docker logs and journal found no surviving Provider error message, stack or stage
for task `tsk_216ff5607b3243c2aabb72c04ae8d024`.

The diagnostic therefore used one disposable, read-only container attached only to
`tikdd_provider-egress`. It instantiated the real `SSSTwitterProvider` and exercised its normal
`requestText()` path through a pass-through fetch observer. It had no API, queue, database, Redis,
Delivery or data-network connection. The observer accepted only the reviewed SSSTwitter page hosts,
recorded sanitized request/response metadata, and did not request a media or CDN URL. No runtime
source, parser, request field, redirect rule or canonicalization behavior was changed.

The submitted source was
`https://x.com/SpaceX/status/2093477720638341395?s=20`; normal platform detection produced
`https://x.com/SpaceX/status/2093477720638341395`. The URLs differ only by removal of the `s` query
parameter. The Provider received the canonical URL and succeeded on the first and only resolve
invocation, producing eight normalized formats and eight candidates, all classified to the reviewed
`ssscdn.io` host. Because the primary invocation succeeded, the conditional source-URL control was
not permitted or executed.

The sanitized page-request sequence was:

| Step | Request | Request characteristics | Response evidence |
| ---: | --- | --- | --- |
| 1 | `GET https://ssstwitter.com/` | Chrome 152 User-Agent; `Accept: text/html,application/xhtml+xml`; no request cookie or body | 200; `text/html; charset=UTF-8`; 87,726 bytes; SHA-256 `c808e38c2a39a535a2b9bf2c494b0c683dbba1ca999ce108247025ee624d5f5c`; one form, include-values marker, no `#result`, no challenge marker, 32 anchors; no response cookie |
| 2 | `POST https://ssstwitter.com/` | Same User-Agent and Accept; URL-encoded form; HTMX target headers; same-origin Origin and Referer; no request cookie; fields `id`, `locale`, `source`, `ts`, `tt`; `id` matched the canonical URL; token values were not retained | 301; HTML; 89,205 bytes; SHA-256 `da0900ab5ae71ebe1672cee6563addfb2090aaec04fa41a028c83d54f9373657`; `#result` and `ssscdn.io` markers present; no challenge marker; response set one `__cflb` cookie |
| 3 | `GET https://ssstwitter.com/result_normal?en` | POST body and Content-Type removed by the normal 301 transition; HTMX, Origin and Referer retained; one `__cflb` cookie forwarded (name and 50-byte header length only; no value retained) | 200; HTML; 71,653 bytes; SHA-256 `4d880dc026a98e424321c5d68ad8ca1e0c18253ff436d96e5ade0fa555bdfcb7`; complete `#result`, result-normal and `ssscdn.io` markers; no form or challenge marker; 44 anchors |

The observer did not record the POST response's relative `Location` value because its sanitizer
required an absolute URL. No rerun was authorized or necessary: the immediately following request
made by the unmodified redirect implementation proves that the header resolved same-origin to
`/result_normal?en`. This instrumentation limitation is confined to the evidence record and did not
alter redirect handling.

There was no `ProviderError` and no failure stage in this isolated invocation. Canonicalization,
the reviewed browser-compatible request headers, normal POST-to-GET redirect, Provider-issued cookie
forwarding, result markup and the current parser all succeeded in the controlled production-image
path. This narrows the prior task result to either context outside the isolated Provider invocation
or a transient upstream response during the earlier task; the evidence does not distinguish those
possibilities and does not justify choosing either one.

After capture, the disposable container was absent, the Nginx checksum remained
`151874488389e5a2e8e426c247420b10947c8459bc757b30516bf83680045139`, all six TikDD containers were
healthy with zero restarts, and the shared-host stage gate passed. TwitterSaver, DLPanda and
SSSTwitter remained disabled; rollout and Canary remained disabled; allocation remained zero; and
the public task endpoint returned normal application validation. No Delivery ticket was created and
no media body was requested or transferred.

P0-X-EVIDENCE-01 therefore closes only the isolated differential capture. X remains non-stable, the
X Production Evidence Gate remains open, and Work Item 17 was not started. The next separately
scoped investigation should retain sanitized Provider error stage and request-transition metadata
inside one exact authorized Worker/Router task attempt without changing Provider behavior.

### P0-X-E2E-VERIFY-01 production Worker revalidation

The documentation-only P0-X-EVIDENCE-01 record merged through PR #21 at
`855151599b2cbd38bf94bb29259d3b54a7a9da44`. That merge became the starting main SHA for one
owner-authorized production Worker revalidation on 2026-09-01. The deployed application remained
`251b02b39c66cc949a299f9f24c7c9533bb85d73`, using unchanged Service image
`ghcr.io/wepuu/tikdd-service@sha256:6f8d237ee1af9b64f0a2e14bb7593562b43d335e3807aa221c90bc2e35f6da72`.
No runtime source or image was changed.

The maintenance window blocked public task creation at Nginx before any Provider gate opened. It
enabled only SSSTwitter, admitted only `ssstwitter` / `x` / `nl` through a 15-minute exact rule, and
kept TwitterSaver, DLPanda and Canary disabled. One loopback API request submitted the reviewed
source URL `https://x.com/SpaceX/status/2093477720638341395?s=20`; Worker platform detection supplied
the canonical URL `https://x.com/SpaceX/status/2093477720638341395`. Task
`tsk_71b987d310db49e68cde899b806c6b64` used the real API, persistence, BullMQ, Worker,
ProviderRouter and SSSTwitter path, then reached terminal `failed` with `PROVIDER_UNAVAILABLE`.

Its sanitized attempt ledger was:

| Provider | Platform | Region | Status | Failure | Retryable | Fallback allowed | Duration |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| SSSTwitter | X | NL | failed | `provider_schema_changed` | yes | yes | 1,010 ms |
| SSSTwitter | X | NL | failed | `provider_schema_changed` | yes | yes | 1,026 ms |

The task produced zero normalized formats and zero encrypted candidates. Its public representation
contained no `ssscdn.io` URL, candidate field, host-policy field, secret header or encrypted
payload. Because resolution failed, no Delivery ticket was created, no `/d/:token` redemption or
302 occurred, and TikDD transferred no media bytes.

The authorized conditional control then used one effective disposable invocation of the actual
`SSSTwitterProvider.resolve()` with the same image, Node runtime, NL host, Provider-only egress and
canonical URL. It succeeded with eight formats and eight candidates, whose only sanitized hostname
was `ssscdn.io`. Two temporary-control bootstrap attempts had stopped before loading or invoking the
Provider—first on host file permissions and then on module-format transformation—so they made zero
Provider or network requests and did not increase the one effective control invocation.

This is failure-matrix Case B: the failure correlates with the Worker/Router execution context rather
than the isolated SSSTwitter HTTP implementation. It does not identify the narrower deterministic
cause inside that context and does not justify changing headers, redirects, cookies,
canonicalization, parser, timeout, retries or egress. P0-X-HTTP-01 therefore remains open. A future
separately reviewed work item should observe only the delta between direct
`SSSTwitterProvider.resolve()` and the Worker-to-ProviderRouter invocation, retaining sanitized
failure-stage metadata without submitting additional tasks under this authorization.

Restoration closed the exact rule as revision 8, disabled with allocation 0 and expired. The
original Nginx checksum
`151874488389e5a2e8e426c247420b10947c8459bc757b30516bf83680045139` was restored, public invalid
task creation again returned 400, and SSSTwitter, TwitterSaver, DLPanda, rollout and Canary flags
were false. All six TikDD containers were healthy with zero restarts, no diagnostic container
remained, and the final shared-host stage gate passed. X remains non-stable, the X Production
Evidence Gate remains open, and Work Item 17 was not started.

### P0-X-WORKER-CONTEXT-01 Worker/Router context isolation

Starting from merged main `3b3418f6257db496d8b1cfdd1c6fe9d855a106eb`, a zero-task context
isolation ran on 2026-09-01 against the unchanged production application
`251b02b39c66cc949a299f9f24c7c9533bb85d73` and immutable Service image
`ghcr.io/wepuu/tikdd-service@sha256:6f8d237ee1af9b64f0a2e14bb7593562b43d335e3807aa221c90bc2e35f6da72`.
It did not create a public or loopback API task, connect a diagnostic Router to production control
sources, enable a Provider, publish allocation, restart the Worker or change runtime code.

Phase A compared the running Worker with the prior disposable-control model. The Worker container
was created at `2026-09-01T06:51:14.282972815Z` and started at
`2026-09-01T06:51:14.647261341Z`. Both environments used image ID
`sha256:6f8d237ee1af9b64f0a2e14bb7593562b43d335e3807aa221c90bc2e35f6da72`, Node
`v24.14.0`, configured user `node`, runtime UID/GID `1000/1000`, working directory `/workspace`,
the `tikdd_provider-egress` network, gateway `172.30.41.1`, a default route through that gateway,
and Docker DNS `127.0.0.11` with search `.` and options `edns0 trust-ad ndots:0`. Both had
`NODE_ENV=production`; `NODE_OPTIONS`, `NODE_USE_ENV_PROXY`, all HTTP proxy variables,
`NODE_EXTRA_CA_CERTS`, `SSL_CERT_FILE`, `SSL_CERT_DIR`, `NODE_TLS_REJECT_UNAUTHORIZED` and
`UV_THREADPOOL_SIZE` were unset.

The observed differences were that the running Worker was also attached to the internal
`tikdd_data` network at `172.30.40.6`, used Provider-egress address `172.30.41.2`, and had container
hostname `3cb8987322de`; the disposable control had only Provider egress, used `172.30.41.4`, and had
hostname `676fe08c3e7f`. These values are context differences, not causal findings. The Provider
egress gateway, default route, DNS, image, user and safe network environment were equivalent.

Test 1 started a separate short-lived Node process inside the existing Worker container and called
the real `SSSTwitterProvider.resolve()` directly. It used the reviewed source and canonical URLs,
a synthetic task ID, a 30-second route signal, an 18-second Provider signal, and
`AbortSignal.any([routeSignal, providerSignal])`. The one effective Provider invocation succeeded
in 1,325 ms with eight formats, eight candidates and only candidate hostname `ssscdn.io`; the
combined, route and Provider signals were all not aborted. Two bootstrap attempts failed during
module loading before constructing or invoking the Provider, so they made no Provider or network
request and did not increase the effective invocation count.

Because Test 1 succeeded, Test 2 ran one additional effective Provider invocation through the real
core `ProviderRouter` inside the same Worker container. The diagnostic used exactly one enabled
SSSTwitter Provider, region `nl`, `production=true`, `maxAttempts=1`, the same 30-second outer route
signal, an in-memory allow decision, a closed healthy state, one local concurrency permit, and no
preference override. It did not use production rollout, Redis health, admission concurrency,
route-policy or persistence sources. The Router succeeded in 1,225 ms; its single SSSTwitter attempt
succeeded in 1,217 ms, the permit was acquired and released once, and the result again contained
eight formats, eight candidates and only `ssscdn.io`. No error occurred and the outer signal was not
aborted.

This establishes Boundary C. The Worker Docker network namespace, DNS, safe container environment,
Worker-equivalent AbortSignal composition, core ProviderRouter timeout and result-validation path,
SSSTwitter requests, redirects, cookies, parser and canonical URL are currently disproved as the
deterministic cause. The remaining differential is confined to the long-running Worker process or
its production runtime integrations: BullMQ job execution, production rollout source, route-policy
source, health source, concurrency source, or process-global runtime state. This task did not attach
to the Worker main PID or investigate those integrations further.

The two effective Provider calls made no candidate/CDN request, no media transfer and no Delivery
ticket. Final safety verification found no active resolution task, rollout rule revision 8 still
disabled with allocation 0 and expired, all Provider and Canary flags false, and the public invalid
task request returning 400. Nginx retained checksum
`151874488389e5a2e8e426c247420b10947c8459bc757b30516bf83680045139`; all six containers were healthy
with zero restarts; and the shared-host stage gate passed. P0-X-HTTP-01 remains open, X remains
non-stable, the Production Evidence Gate remains open, and Work Item 17 was not started.

### P0-X-WORKER-TRACE-01 task-scoped long-running Worker trace

The trace investigation started from merged main
`7545026fb35e8697458a5913f06eff966a1a4ca0`. Before any Provider request, Phase A established that
the then-current Worker was not the process that handled the earlier failed task. The historical
task finished at `2026-09-01T06:51:08.635179Z`; the inspected Worker PID 1 started at
`2026-09-01T06:51:13.970000Z` (host PID `422051`) and had no matching retained log entry. Its safe
activation, rollout and runtime settings matched the Docker configuration and host environment
exactly. A repository-wide inspection also found no repository-owned global fetch/dispatcher
mutation. The earlier conclusion that a single long-running process failed the task and later
succeeded in short-lived controls is therefore corrected: those observations came from different
processes.

PR #24 added a default-off, task-scoped diagnostic trace and merged as
`84c2f95e74aca8c26c4917fa66f030c114dcd6d3`. It activates only for the exact
SSSTwitter/X/NL tuple whose canonical URL SHA-256 and authorization ID match configuration, and it
hard-caps output at two Provider invocations. The observer records only structured stage, process,
signal, request-shape, response-shape, body-digest and marker metadata. It does not record source or
candidate URLs, cookie or form-token values, HTML, response bodies or secrets, and does not change
fetch, request headers, redirects, body handling, timeouts, retries, parsing or candidates. Tests
prove that enabled and disabled fixture resolutions are identical and that the existing redirect
code neither consumes nor cancels an intermediate manual-redirect response body.

The merged Worker image
`ghcr.io/wepuu/tikdd-service@sha256:edb4cf52bcb4ac931f14b250520f126afa4eed054524a3c790544d62a1a781ca`
was deployed only to the Worker. Its traced process started at
`2026-09-01T09:02:29.666437287Z` (host PID `523483`; Node namespace PID `52`). Public task creation
was blocked before SSSTwitter and a short-lived exact rollout rule were enabled. Exactly one
authorized API task, `tsk_cca48401dd5a4c10ad7b5193e18991d6`, ran from
`2026-09-01T09:05:05.261605Z` to `2026-09-01T09:05:12.055843Z` and ended `failed` with
`PROVIDER_UNAVAILABLE`.

The first traced invocation completed the full Provider sequence:
`resolve_start`, landing request/response, form parse, POST request, result response/parse,
resolution creation and `resolve_success`. It ran from `09:05:05.324Z` to `09:05:06.647Z`, with
an un-aborted signal, one active Provider invocation, process uptime 154–155 seconds and RSS
109–126 MiB. Its HTTP sequence was `GET /` 200, `POST /` 301 and same-origin
`GET /result_normal` 200. The landing body was 87,726 bytes with SHA-256
`c808e38c2a39a535a2b9bf2c494b0c683dbba1ca999ce108247025ee624d5f5c`; the final result body was
71,653 bytes with SHA-256
`222da9a98adee858df04df40d851b01e653dd760770442ddc3693ee10414d710`. Expected form/result and
`ssscdn.io` markers were present, while challenge/block markers were absent. The adapter produced
eight formats and eight candidates, all on `ssscdn.io`.

That successful Provider resolution was followed by an error outside the traced Provider boundary,
before the successful result and attempt ledger could be committed. BullMQ retried normally. The
second traced invocation reached `result_parse_start` and failed at `09:05:09.055Z` with
`provider_schema_changed`: `SSSTwitter did not return its result container.` Its HTTP sequence was
`GET /` 200 then `POST /` 200; the POST response body was zero bytes (the empty-body SHA-256), with
no result, CDN, challenge or block marker. Its signal was not aborted, concurrency remained one,
process uptime was 157–158 seconds and RSS was 127 MiB. A third normal Provider invocation ran after
the trace hard cap and failed the same way. The sanitized persisted ledger contains the two failed
attempts: 1,310 ms and 877 ms, both retryable and fallback-eligible. The trace itself contains
exactly two invocations and 35 events.

This is mixed evidence. A fresh normal Worker invocation disproves a deterministic failure in the
Worker process, its current network namespace, current SSSTwitter request sequence or parser. The
later direct HTTP 200 with an empty body demonstrates a transient upstream response shape that the
typed `provider_schema_changed` path handled correctly. Separately, the first Provider success was
lost at an untraced post-Router/candidate/persistence boundary. This evidence does not identify that
downstream error and does not authorize a repair. P0-X-HTTP-01, X stability and the Production
Evidence Gate remain open; a separately scoped investigation must trace the post-Router completion
boundary before changing behavior.

The sanitized evidence file is retained as
`/var/backups/tikdd/p0-x-worker-trace-01.sanitized.jsonl` (35 lines, 21,854 bytes, mode 0600,
SHA-256 `7e8ab5579f8a393e8ebe99c8db668c68eb2c89cb12843d5e440212f20aed2551`). No Delivery ticket,
candidate/CDN request or media transfer occurred. Restoration disabled the exact rule at revision
10 with allocation 0, disabled all Providers, rollout, health, Canary and diagnostic trace flags,
cleared the trace hash and authorization ID, and restored the original Nginx checksum. Public
invalid task creation returned 400, all six containers were healthy with zero restarts, and the
final shared-host stage gate passed.

### P0-X-COMPLETION-EVIDENCE-01 completion failure isolation

Starting from execution-time main `a47707f4c4b3367bae1fdd195a4eb2c4c194df9d`, this investigation
used only retained logs, BullMQ metadata, PostgreSQL catalog reads, safe environment-presence checks
and sanitized local fixtures. It made zero Provider, CDN, Delivery or resolve-task requests and did
not change runtime code, a production image, database privileges or production data.

The retained BullMQ job for `tsk_cca48401dd5a4c10ad7b5193e18991d6` still existed in `failed`
state. It recorded `attemptsMade=3`, configured attempts `3`, timestamp
`2026-09-01T09:05:05.276Z`, final-attempt `processedOn=2026-09-01T09:05:11.160Z` and
`finishedOn=2026-09-01T09:05:12.053Z`. Its final `failedReason` was
`All eligible providers failed for x.`, but its three retained stack traces preserve the real
sequence:

1. Attempt 1 failed with `error: permission denied for table delivery_candidates` in
   `TaskRepository.completeWithResolution()` at `packages/persistence/src/index.ts:435`.
2. Attempts 2 and 3 failed in `ProviderRouter.resolve()` with
   `ProviderRoutingError: All eligible providers failed for x.`

Line 435 is the first write in the completion transaction:
`DELETE FROM delivery_candidates WHERE task_id = $1`. The preceding `BEGIN` and
`SELECT resolve_tasks ... FOR UPDATE` succeeded. PostgreSQL rejected the DELETE before any candidate
INSERT, provider-attempt INSERT, task-success UPDATE or admission DELETE could commit, and the catch
path rolled the transaction back. The retained BullMQ string does not preserve the structured
PostgreSQL `code` property; the canonical SQLSTATE for `insufficient_privilege` is `42501`. The
identified table is `delivery_candidates`; no constraint was evaluated or implicated.

Production catalog inspection used the Worker's own `tikdd_worker` database credential in a
read-only transaction. `current_user` and `session_user` were both `tikdd_worker`, and
`has_schema_privilege(..., 'public', 'USAGE')` was true. Relevant table privileges were:

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `resolve_tasks` | yes | yes | yes | no |
| `delivery_candidates` | yes | yes | yes | **no** |
| `provider_attempts` | yes | yes | yes | no |
| `active_source_admissions` | yes | yes | yes | yes |

The no values on `resolve_tasks` and `provider_attempts` DELETE are not used by this success path.
The missing `delivery_candidates.DELETE` privilege is required unconditionally, even when the task
has no previous candidate rows. Column-grant inspection found SELECT/INSERT/UPDATE grants for every
candidate column but no independent DELETE capability. Candidate IDs are application-generated and
no sequence privilege is required.

The live `delivery_candidates` schema contains all fields written by the current transaction:
`id`, task/format/provider identifiers, platform, region, observation class, mode, host policy,
encryption algorithm/key/IV/payload/tag and expiry. Their types, nullability, ID/format/provider/
region checks, AES-GCM byte-length checks, task foreign key and task/format uniqueness match the
current code. Schema drift or a constraint failure is therefore not the observed cause.

The Worker had both `DELIVERY_ENCRYPTION_KEY_ID` and secret key material present through the
reviewed secret entrypoint, and the actual `createCandidateCipherFromEnvironment()` constructed an
`AesGcmCandidateCipher` successfully without exposing either value. A local deterministic call to
the real `prepareEncryptedCandidates()` used eight sanitized SSSTwitter-style redirect candidates
and a static fixture cipher. It returned eight encrypted candidates, all IDs matched
`dvc_[a-f0-9]{32}`, all format IDs matched, AES-256-GCM was used and the plaintext fixture target
hostname was absent from serialized output. Candidate preparation was therefore ready and is not
the isolated failure.

The final task row is `failed`, public observation class, with generic
`PROVIDER_UNAVAILABLE`, no result, zero delivery candidates, zero successful provider-attempt rows
and zero active-source admission rows. Only the later two failed `provider_schema_changed` attempts
(1,310 ms and 877 ms) committed. Absence of attempt-1 artifacts is explained by the transaction
rollback; it does not mean the first SSSTwitter invocation failed.

Repository migrations create the candidate table, but do not provision the production
`tikdd_worker` role or its base table grants. Migration `0019_task_admission_api_delete_grants.sql`
adds the separately discovered `active_source_admissions.DELETE` permission when that external role
exists. No equivalent migration or versioned production-role provisioning grants
`delivery_candidates.DELETE`; the remaining production role baseline is therefore external to the
repository and drifted from the completion contract.

The exact incident classification is now:

> The first traced SSSTwitter Provider invocation succeeded. Candidate preparation was available.
> `completeWithResolution()` began, then PostgreSQL rejected its candidate-replacement DELETE
> because `tikdd_worker` lacked `delivery_candidates.DELETE`. BullMQ retried the complete job, later
> Provider responses failed, and the final handler masked the original local failure as generic
> `PROVIDER_UNAVAILABLE`.

The evidence task stops here without repair. Recommended independent scopes are:

- `P0-X-COMPLETION-01`: version and verify the exact Worker production grants required by the
  atomic completion transaction, beginning with `delivery_candidates.DELETE`.
- `P0-X-RETRY-MASKING-01`: prevent a post-Provider local failure from re-running external resolution
  and preserve truthful terminal error semantics and the successful attempt ledger.

P0-X-HTTP-01 remains open, X remains non-stable, the Production Evidence Gate remains open and Work
Item 17 was not started. Production remains fail-closed with all Providers, rollout, health, Canary
and diagnostic trace disabled and allocation zero.

### P0-X-COMPLETION-01 permission repair

Repository main `2d60ae48e5cddf112f67ecdf8287b78c5334225a` now owns the production
Worker completion permission contract. Idempotent migration
`0020_worker_delivery_candidate_delete_grant.sql` conditionally grants only
`DELETE ON TABLE delivery_candidates` to an existing `tikdd_worker` role. It does not revoke,
transfer ownership, grant all privileges or change another role. A repository verifier connects
with the identity under test and checks the exact role, public schema usage and the seven
privileges used by the completion transaction. Focused tests cover the migration scope, all-pass,
missing candidate DELETE, wrong database identity and missing schema usage. A disposable
PostgreSQL instance executed the migration twice successfully and confirmed candidate DELETE after
both applications.

The minimum production artifact was the immutable Service image
`ghcr.io/wepuu/tikdd-service@sha256:e913b8ea73aab4fcbcdbee83d92d3c030a38d0e9de65444322b8d7fc52371580`,
whose OCI revision is the merged main SHA above and whose runtime platform is Linux/amd64. Before
migration, production had the expected `tikdd_worker` role, candidate DELETE was false, no active
resolve task existed, all Provider gates were off and the shared-host stage gate passed. A
custom-format PostgreSQL backup was written to
`/var/backups/tikdd/pre-p0-x-completion-01-2d60ae48.dump` (167,161 bytes; SHA-256
`081f9ba380128fc80c24c114158ab9f46b7efd39c33932b25bf16c7abe489d43`) and its
`pg_restore -l` catalog check passed.

The repository-approved one-shot Compose migration service used that exact image digest, replayed
the ordered repeatable migration set and reported `Applied migration
0020_worker_delivery_candidate_delete_grant.sql`. No ad-hoc manual GRANT was used. The repository
verifier then ran in a one-shot container with the production Worker secret binding and reported:

| Check | Production result |
| --- | --- |
| Database identity is `tikdd_worker` | PASS |
| `public.USAGE` | PASS |
| `resolve_tasks.SELECT` | PASS |
| `resolve_tasks.UPDATE` | PASS |
| `delivery_candidates.INSERT` | PASS |
| `delivery_candidates.DELETE` | PASS |
| `provider_attempts.INSERT` | PASS |
| `active_source_admissions.DELETE` | PASS |
| Complete Worker contract | PASS |

The GRANT became effective without replacing or restarting the long-running Worker. Its image
remained `sha256:edb4cf52bcb4ac931f14b250520f126afa4eed054524a3c790544d62a1a781ca`,
start time remained `2026-09-01T09:05:16.587009581Z`, health remained healthy and restart count
remained zero. API, Delivery, Web, PostgreSQL and TikDD Redis were also healthy with zero restarts;
the final shared-host stage gate passed and no one-shot migration/verifier container remained.

P0-X-COMPLETION-01 made zero SSSTwitter, TwitterSaver, DLPanda, CDN or Delivery requests and created
no resolve task or ticket. All Providers, rollout, health, Canary and diagnostic trace remained
disabled; the SSSTwitter/X/NL rule remained revision 10, disabled, with allocation zero. This closes
only the confirmed persistence-permission repair. P0-X-RETRY-MASKING-01 and P0-X-HTTP-01 remain
open, X remains experimental/non-stable, the Production Evidence Gate remains open and Work Item 17
was not started.
