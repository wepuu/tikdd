# Work Item 98 — xHamster hidden homepage promotion and public Beta page

## Scope

Add the curated `xhamster` platform and a disabled-by-default LocoLoader adapter for public
xHamster video URLs. The page is reachable for direct users but remains Beta and non-indexable.
No homepage, FAQ, help, sitemap, hreflang, or structured-data promotion is added.

## Technical implementation

- Explicit `xhamster.com` host detection with spoofed-host tests.
- LocoLoader site-adapter flow: obtain the landing cookie, calculate the short-lived form key,
  submit the anonymous `api-extract` request, and normalize only HTTPS MP4 resources on reviewed
  `*.xhcdn.com` hosts.
- Optional upstream metadata is ignored when absent; duplicate and unsafe media links are dropped.
- A versioned `locoloader-xhamster-media-v1` redirect policy protects the Delivery boundary.
- LocoLoader gates default to false and the provider performs one bounded execution per task; no
  production rollout rule is created.

## SEO and release boundary

The bilingual `/xhamster-downloader` seed pages use the existing platform template, `noindex`,
and `includeInSitemap=false`. Stable-only SEO rules are unchanged. Publishing a content snapshot,
enabling the provider, and creating a rollout rule are separate owner-authorized operations.

## Verification

Targeted parser, host-policy, platform detection, activation, retry, sitemap, and metadata tests
must pass with `pnpm check` and `git diff --check`. No real adult sample URL, token, cookie,
response body, or complete CDN URL is stored in the repository.
