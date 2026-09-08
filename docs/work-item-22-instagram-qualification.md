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
| Real Instagram resolve and MP4 choice | complete: browser tasks `tsk_d51e536156a0403f85bb85297ad7fe55` and `tsk_a21e3cbfa4974fbab403cf7119031c83` each resolved one 720P MP4 |
| Delivery ticket and non-zero browser download | complete: both browser downloads completed; each emitted successful ticket creation, redirect validation, and browser handoff outcomes |
| 15-minute health and circuit watch | complete: 10 one-minute samples plus the final sample recorded zero unhealthy core containers, restarts, API 5xx, Delivery errors, circuit opens, failed SaveFromIns attempts, or failed Delivery outcomes |
| Final route state and rollback command recorded | complete: rule revision 9 is enabled with allocation 10000; the three SaveFromIns gates are true and the revision 9 rollback script was staged before activation |

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

## 2026-09-07 successful production qualification

The owner granted the follow-up authorization for the exact `savefromins` / `instagram` / `nl`
route, both supplied Reel samples, all three SaveFromIns gates, and immediate rule-first rollback on
failure. Production was already running immutable GitHub release
`9029d1213e62011e8f7c0b502d9461b61006b2e6`. The operator confirmed the safe starting state at rule
revision 8 with zero allocation, backed up both production environment files, enabled only the
three SaveFromIns gates, restarted only Worker, and applied the rollout update with revision 8 CAS.
The resulting rule is revision 9, enabled, with allocation 10000 and no expiry.

Both owner-supplied public Reels completed the real browser path from URL submission through MP4
selection, ticket creation, and media download. Task `tsk_d51e536156a0403f85bb85297ad7fe55`
resolved through SaveFromIns in 4946 ms; task `tsk_a21e3cbfa4974fbab403cf7119031c83`
resolved in 5355 ms. Each produced one 720P MP4 and a completed non-zero browser download. The
Delivery evidence contains two `ticket_creation=succeeded`, two `redirect_validation=passed`, and
two `browser_handoff=redirect_issued` outcomes, with no failed outcome.

The observation ran from the 11:12:37 UTC activation through the 11:29:49 UTC final sample. Ten
one-minute samples and the final independent sample consistently recorded two successful and zero
failed SaveFromIns attempts, six successful-class and zero failed Delivery outcomes, zero API 5xx,
zero Delivery errors, zero circuit opens, and six healthy core containers with zero restarts. The
unrelated failed tasks visible during the window targeted `ok.ru` while that Provider remained
disabled; no new Instagram task failed. Admin and calibration remained stopped,
`PROVIDER_PILOT_GUARD_REQUIRED` remained false, and TwitterSaver and DLPanda remained disabled.

The successful qualification leaves Instagram Beta live at rule revision 9. The staged rollback is
still rule-first: CAS revision 9 to disabled with zero allocation, then restore the backed-up
environment files and restart Worker. A release rollback is not indicated by this evidence.

Work Item 22 is complete with current Delivery evidence and the operator-approved bounded rollout.
Work Item 23 owns the separate Instagram landing page and SEO eligibility decision.
