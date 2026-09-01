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
