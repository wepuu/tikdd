# Work Item 43 — Provider capability and routing foundation

## Scope

Stage 9 is a capability-and-routing batch, not a new Provider launch. It gives the owner one
readable effective route plan and a repeatable gate for evaluating future free candidates.

## Delivered locally

- Shared effective route scoring and bounded plan derivation in `@tikdd/route-policy`.
- Worker ranking now uses the shared score without changing sequential fallback or maximum attempts.
- Admin Providers workspace shows the effective `primary → fallback` order, eligible-but-not-selected
  candidates, and sanitised exclusion reasons.
- Advanced route writes and qualification controls are folded under an explicit impact warning.
- Provider onboarding checklist and ADR-0030 document the no-cookie/public boundary, host policy,
  normalised contracts, test fixtures and release gate.

## Explicitly not in this item

- No new Provider implementation or third-party request.
- No database migration, public API change, rollout change or delivery architecture change.
- SaveFromIns remains the current Instagram Beta route. Do not increase its test frequency while
  evaluating candidates.
- Admin, calibration and other Provider traffic remain governed by the existing production flags.

## Verification and handoff

Run the route-policy, providers and Admin targeted tests, then `pnpm check` and production Compose
validation. After the Stage 8/9 PRs are merged, deploy once from the GitHub SHA image only after a
separate approval. Production verification is one owner-controlled X download and at most one
Instagram download, followed by a short health observation; do not probe SaveFromIns repeatedly.
