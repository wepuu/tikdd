# Work Item 22 — Instagram Beta qualification

## Objective

Qualify the exact `savefromins` / `instagram` / `nl` route through TikDD's existing bounded
Provider, rollout, circuit, and Delivery controls. Keep the change small: public disclosure and
release preparation first, then a separately authorized production activation and one real browser
download. No calendar-length calibration, Admin profile, or Instagram SEO landing page is required.

## Baseline

- Source and deployed baseline: `main@00bc4b9`.
- X remains live through the existing `ssstwitter` / `x` / `nl` rule.
- SaveFromIns code and Delivery policy are deployed, but all Provider gates are false.
- SaveFromIns approval fields are empty; no Instagram rollout rule exists; attempt count is zero.
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
| Phase A PR CI and immutable images | pending |
| Production backup and default-off deployment | pending |
| Owner activation authorization | pending |
| Real Instagram resolve and MP4 choice | pending |
| Delivery ticket and non-zero browser download | pending |
| 15-minute health and circuit watch | pending |
| Final route state and rollback command recorded | pending |

Work Item 22 exits only after current delivery evidence and an operator-approved bounded rollout.
Work Item 23 owns the separate Instagram landing page and SEO eligibility decision.
