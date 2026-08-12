# Work item 12.9.1 Product Design QA

Date: 2026-08-13

Surface: authenticated TikDD owner console at `/`, deployment `tikdd`, region `nl`

Viewports: desktop default and `390 × 844`

## Product frame

- Audience: the single TikDD site owner.
- Primary job: choose one platform and region, understand which Providers can resolve and deliver it,
  then adjust only the production-eligible route policy.
- Visual direction: retain the existing blue-gray control surface, mint production signal, amber
  technical-validation signal, compact Phosphor icon system, and the capability rail as the
  signature visual element.
- Safety hierarchy: platform scope first, code-owned capability second, live operational route
  third, guarded mutation last.

## Fresh evidence

- Before: `docs/design/work-item-12-9-1/02-provider-routing-desktop-before.png`
- Before mobile: `docs/design/work-item-12-9-1/04-provider-routing-mobile-before.png`
- Final mobile: `docs/design/work-item-12-9-1/06-provider-routing-mobile-final.png`
- Final desktop: `docs/design/work-item-12-9-1/07-provider-routing-desktop-final.png`

All evidence was captured from the real authenticated Admin page. No fixture fallback, credential,
Cookie, submitted URL, media URL, or raw Provider payload was captured.

## Findings and closure

| Severity | Evidence | Finding | Closure |
| --- | --- | --- | --- |
| P0 | Before desktop/mobile | Platform selection was driven only by operational routes. A catalog platform without a live route could appear in the matrix but could not become the authoritative policy scope. | The selector now includes the union of catalog, manifest, and operational platforms. A `policyPlatform` query loads the exact `(platform, region)` policy even with no route summary. |
| P0 | Before desktop | Capability matrix and policy editor could communicate different platform scopes after changing the matrix selector. | One `platform` state now drives the scope band, matrix, runway, policy read, refresh, and exact command confirmation. |
| P1 | Before desktop | The matrix sat after the live runway, making code capability harder to understand before reading health and allocation. | The matrix now precedes the operational runway: scope → capability → runtime → guarded policy. |
| P1 | Before desktop | `productionEligible: false` collapsed disabled delivery-capable Providers and true resolution-only Providers into one visual meaning. | Delivery capability is rendered independently from deployment eligibility; rows now say `生产合格`, `当前未启用`, or `仅解析`. |
| P1 | Before mobile | The first routing viewport started with a wide runway and horizontal scroll before explaining candidate eligibility. | A compact decision-scope band and single-platform two-column matrix now fit the mobile reading order before the runway. Horizontal scrolling remains only where the route graph genuinely needs it. |
| P1 | DOM/accessibility | Provider search had placeholder text but no accessible label; the platform selector exposed a redundant `全部平台` matrix mode that weakened the exact-scope mental model. | Added an explicit accessible name and removed the aggregate matrix scope from the operational task. |
| P2 | Empty-platform state | A platform without a live route silently removed the policy control because it depended on a selected route summary. | The baseline policy remains visible; exact route pause/resume/Probe controls remain closed with an explicit explanation. |

## Validation result

- Desktop final evidence shows the decision scope, capability matrix, then exact runtime route in one
  continuous reading sequence.
- The `390 × 844` final viewport has no page-level horizontal overflow; the top navigation remains
  keyboard reachable and the three exact-scope fields fit in one row.
- Selecting YouTube (no current operational route) displays `youtube/nl`, zero production routes,
  the code-owned capability projection, an empty live runway, and a guarded policy view without
  enabling route-specific commands.
- Selecting X separates TwitterSaver/SSSTwitter redirect capability from their current disabled
  deployment status, while DLPanda remains visibly resolution-only.
- Reduced-motion behavior and the existing visible focus ring remain unchanged.

P0 and P1 findings for work item 12.9.1 are closed.
