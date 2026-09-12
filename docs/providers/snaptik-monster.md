# SnapTik Monster Provider

## Decision

`accepted` for adapter implementation and fixture validation; production traffic remains disabled.
The candidate was supplied by the owner and received one bounded feasibility probe on 2026-09-12.
The probe returned an HTML result for a public TikTok video without a login or interactive challenge,
including an MP4 download link on the reviewed exact host `tikcdn.beubagah.com`.

The probe is feasibility evidence only. It is not a production rollout approval or a claim of
long-term availability.

## Capability

- Provider id: `snaptik-monster`.
- Platform: public TikTok video URLs only.
- Region: `nl`, `global`, and `canary-global` are declared; no allocation is granted by this change.
- Delivery: redirect only through `snaptik-monster-tiktok-media-v1`.
- Page host allowlist: `snaptik.monster` and `www.snaptik.monster`.
- Media host allowlist: exact `tikcdn.beubagah.com`; subdomains and look-alikes are rejected.
- Default state: disabled. Enabling requires independent terms and Delivery audit gates.

The adapter obtains the public page CSRF token, submits only the canonical TikTok URL, and parses
reviewed MP4 anchors. It does not use account cookies, bypass challenges, expose upstream URLs, or
proxy media bytes. The normalized result contains no downloadable media URL; an optional reviewed
thumbnail is treated as presentation metadata, while encrypted Delivery candidates are the only
place where the internal redirect target is retained.

## Error and safety boundary

HTTP rate limits, timeouts, 5xx responses, challenges, malformed tokens, and missing reviewed MP4
resources remain retryable/fallback-allowed according to the shared Provider error policy. Private
and removed posts are terminal. Unknown media hosts never widen the Delivery policy.

Deterministic fixtures cover success, private content, empty results, missing token, challenge,
rate-limit, and unreviewed-host behavior. Live requests are not part of CI and should not be used
as a frequent test loop; use the existing bounded canary/health process after explicit approval.

## Candidate decisions in this batch

- `ssstik.io`: deferred after a single bounded parse attempt returned an empty response body; no
  adapter or host policy was added.
- `snaptik.monster`: accepted for the disabled adapter described above.
- `ttsave.net`: deferred because its current public flow starts a server-side MP4 job, which is
  incompatible with TikDD's redirect-only direct-to-CDN delivery boundary.
- `collabstr.com`: rejected as a creator/marketing marketplace, not a media-resolution Provider.

## Operations

Before any production enablement, review current terms, run a scheduled canary with an owner-
authorized public URL, verify redirect host/DNS behavior and non-zero browser delivery, then create
the normal rollout rule. If challenges, repeated 403/429 responses, or invalid media appear, disable
the rollout before disabling the Provider gates. No production environment or existing X/Instagram
rollout is changed by this work item.
