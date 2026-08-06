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
permits the bounded live canary but does not establish production or commercial-use approval.

## Test and operations notes

- Success fixtures are synthetic and use only `media.invalid` URLs.
- The 2026-08-04 authorized TikTok canary reached a Cloudflare challenge in this execution region.
  TikDD returned `provider_challenge` and did not attempt a bypass.
- A routing canary then verified that the scheduler recorded the DLPanda failure and selected the
  lower-priority development mock fallback.
- The authorized canary and its data-handling boundary are recorded in
  [canary-authorization.md](canary-authorization.md).
- Monitor Cloudflare challenge rate per region, token absence, parse errors, schema changes, p95
  latency, and response-size limits.
- Kill switch: `ENABLE_DLPANDA_PROVIDER=false`.
