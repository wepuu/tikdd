# DLPanda provider record

- Provider ID: `dlpanda`
- Site: <https://dlpanda.com/>
- Kind: third-party site adapter
- Declared platforms: TikTok, Douyin, Xiaohongshu/RedNote, X, Bilibili, Weibo, Vimeo, Facebook,
  Snapchat, Pinterest, Xigua, and Oasis
- Explicitly excluded: Instagram
- Default state: disabled
- Technical review: 2026-08-04
- Test authorization: project owner asserted on 2026-08-04
- Production approval: not established; production enablement remains blocked

## Work item 10.1 X qualification

- Qualification tuple: `dlpanda` / `x` / `global`
- Lifecycle stage: `fixture-ready`
- Pause/block reason: `provider_challenge` in the current `global` execution region
- Qualification owner: `project-owner`
- Evidence owner: `project-owner`
- Rollout operator: `project-owner`
- Rollback owner: `project-owner`
- X page hosts: exact `dlpanda.com` and `www.dlpanda.com`
- X media hosts and redirect behavior: not established
- Delivery candidate coverage: none; the current adapter emits no candidates
- User credentials: forbidden; the adapter accepts no user cookie or account credential
- Provider session state: only the provider-issued form session cookie may flow between reviewed
  DLPanda page requests; it is never a delivery credential or public field
- Rate and concurrency: one manual qualification canary at a time; no production rate is approved;
  later traffic requires the distributed provider concurrency permit
- Kill switch: `ENABLE_DLPANDA_PROVIDER=false`
- Production/commercial approval: not established

Deterministic X routing fixtures pass and prove typed fallback to DLPanda after a retryable primary
failure. The project owner then authorized one exact DLPanda/X canary on 2026-08-10. The direct run
returned `provider_challenge` after 1,467 ms and stopped without media requests, provider fallback,
or challenge bypass. Its one-time configuration entry was removed after execution.

The tuple remains `fixture-ready` and is paused for the current `global` region. It is not
`canary-ready`: regional live resolution failed, and no media host, redirect behavior, link
lifetime, reviewed host policy, or delivery candidate could be established. DLPanda is rejected as
the second X pilot provider for this region unless a separately reviewed region later receives its
own explicit authorization and passes the full ADR-0008 gate.

## Public workflow observed

DLPanda publishes one platform-specific form per site. The form first exposes a `t0ken` hidden
field, then submits the public media URL and token back to the same platform path. The adapter loads
the landing form, forwards only the provider-issued session cookie, submits the tokenized GET, and
parses download controls carrying `data-download-url` or an HTTPS download link.

The production site returned a Cloudflare block to this server environment during review, while the
public beta TikTok form exposed the same tokenized protocol and returned a normal parse-error page
for an invalid URL. The adapter maps block/challenge pages to `provider_challenge`, which allows the
router to move to the next provider. It never attempts to bypass the challenge.

## Credential boundary

DLPanda's Instagram page asks users to paste an Instagram `sessionid`, so Instagram is not declared
in the adapter manifest. Its Bilibili page says `sessdata` is required for 1080p or higher; the
adapter does not accept or forward that credential and can only use public, credential-free results.
Any response requesting `sessionid` or `sessdata` becomes terminal `authentication_required`.

TikDD will not add user-cookie fields to its public API for this provider.

## Terms gate

DLPanda's public terms say users are responsible for submitted URLs, prohibit unauthorized
commercial use of third-party content, and do not explicitly grant permission for automated
commercial integration. `ENABLE_DLPANDA_PROVIDER=true` therefore also requires
`DLPANDA_TERMS_APPROVED=true` after project-owner legal review or written permission.

The project owner has asserted that the provider integration and the committed TikTok canary URL are
authorized for technical testing. External legal evidence is not stored in this repository. This
permits that bounded TikTok live canary but does not authorize DLPanda/X or establish production or
commercial-use approval.

## Test and operations notes

- Success fixtures are synthetic and use only `media.invalid` URLs.
- The 2026-08-04 authorized TikTok canary reached a Cloudflare challenge in this execution region.
  TikDD returned `provider_challenge` and did not attempt a bypass.
- The 2026-08-10 one-time authorized X canary also returned `provider_challenge` in 1,467 ms. It made
  no media request and its exact authorization was removed after the run.
- A routing canary then verified that the scheduler recorded the DLPanda failure and selected the
  lower-priority development mock fallback.
- The authorized canary and its data-handling boundary are recorded in
  [canary-authorization.md](canary-authorization.md).
- Monitor Cloudflare challenge rate per region, token absence, parse errors, schema changes, p95
  latency, and response-size limits.
- Kill switch: `ENABLE_DLPANDA_PROVIDER=false`.
