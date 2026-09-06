# Work Item 22 — Instagram Beta qualification

## Objective

Qualify the exact `savefromins` / `instagram` / `nl` route through TikDD's existing bounded
Provider, rollout, circuit, and Delivery controls. Keep the change small: public disclosure and
release preparation first, then a separately authorized production activation and one real browser
download. No calendar-length calibration, Admin profile, or Instagram SEO landing page is required.

## Baseline

- Phase A source and deployed baseline: `main@7ddafbdd418aab656f4807c9d69f6f205f0bbcab`.
- X remains live through the existing `ssstwitter` / `x` / `nl` rule.
- SaveFromIns code, Delivery policy, and bilingual Beta disclosure are deployed.
- The single `savefromins` / `instagram` / `nl` rule exists but is disabled with zero allocation.
- Admin and calibration profiles remain stopped.

## Phase A — release preparation

- Publish bilingual X and Instagram Beta input guidance.
- State that only public posts and Reels are in scope; no account, Cookie, `sessionid`, or private
  content is requested.
- State that the submitted public page URL is sent to a third-party processing service.
- Keep the homepage generic; do not create or index `/instagram-downloader/` in this work item.
- Run targeted tests and `pnpm check`, merge through PR CI, publish immutable GitHub images, back up
  production, and deploy with SaveFromIns still disabled.

## Phase B — separately authorized activation

Activation is not granted by merging or deploying Phase A. The owner must explicitly approve:

- the automated-use decision for SaveFromIns;
- `ENABLE_SAVEFROMINS_PROVIDER=true`;
- `SAVEFROMINS_TERMS_APPROVED=true`;
- `SAVEFROMINS_DELIVERY_AUDIT_APPROVED=true`;
- `PROVIDER_ROLLOUT_ENABLED=true`; and
- creation or CAS update of the single `savefromins` / `instagram` / `nl` rollout rule.

Start with the smallest operationally useful allocation, use one owner-supplied public sample, and
verify resolution, MP4 selection, ticket creation, response type, and a non-zero browser download.
Observe core container health, restarts, API 5xx, sanitized Provider attempts, circuit state, and
Delivery redemption for 15 minutes.

Rollback is two-step and immediate: disable the exact rollout rule first, then return the three
SaveFromIns gates to false. Roll back the release image only if the fault is version-wide rather
than isolated to the Provider route.

## Evidence record

Do not fill a row until it has actually been observed.

| Evidence | Status |
| --- | --- |
| Phase A PR CI and immutable images | complete: PR #54 merged as `7ddafbd`; merge CI and Release images succeeded |
| Production backup and default-off deployment | complete: encrypted backup recorded; six core services deployed healthy from `7ddafbd` |
| Owner activation authorization | complete: `/etc/tikdd/approvals/savefromins-automated-use-20260906.json` |
| Real Instagram resolve and MP4 choice | failed: browser task `tsk_d40f090c411340d78fcbee21d0ddf472` recorded three `invalid_result` attempts |
| Delivery ticket and non-zero browser download | not reached: the failed task created zero Delivery candidates |
| 15-minute health and circuit watch | not started: immediate rollback took precedence after the first sample failed |
| Final route state and rollback command recorded | complete: rule revision 6 is disabled with allocation 0; all three SaveFromIns gates are false |

## 2026-09-06 production qualification result

The owner authorized the automated-use decision, all three SaveFromIns gates, the single exact
rollout rule, both supplied public Reel samples, and an immediate two-step rollback on failure. The
approval record was written before traffic. Phase B then exposed a release-environment binding bug:
Compose interpolation selected an older environment file even though `--env-file` pointed at the
current release file. The operator restored the disabled state, corrected the production pointer,
and repeated the activation only after API and Worker reported healthy with the intended runtime
configuration.

The first real Chrome submission reached the production API. SaveFromIns was attempted three times
within the existing bounded retry policy; every attempt ended as the sanitized `invalid_result`
class. No Delivery candidate or ticket was created. In accordance with the approved failure policy,
the operator did not submit the second sample or begin the 15-minute watch. The exact rollout rule
was disabled first and the three SaveFromIns gates were then returned to false. The final durable
rule is revision 6 with zero allocation; the six core containers are healthy, and Admin and
calibration remain stopped.

This is a failed qualification, not an Instagram Beta launch. A follow-up may inspect the current
upstream format and media-host shape using bounded, redacted evidence. Any Delivery suffix expansion
requires a separate code review and spoofed-host tests; another production attempt requires fresh
operator authorization.

## Repair candidate

Disabled-route diagnostics confirmed that SaveFromIns remains usable for both supplied Reels. Each
returned one direct 720P MP4. One candidate remained under `cdninstagram.com`; the failed production
sample had rotated to an `fna.fbcdn.net` subdomain. Its public DNS, HTTPS Range response, media type,
size, file signature, redirect behavior, and TLS identity passed the bounded review recorded in
ADR-0022.

The repair versions the Delivery policy rather than widening version 1. New candidates use
`savefromins-instagram-media-v2`, which accepts real subdomains of `cdninstagram.com` and
`fna.fbcdn.net` only. Production remains disabled until this change passes PR CI, is deployed from
immutable GitHub images with all gates false, and receives a new owner authorization for the two
browser downloads and short observation.

Work Item 22 exits only after current delivery evidence and an operator-approved bounded rollout.
Work Item 23 owns the separate Instagram landing page and SEO eligibility decision.
