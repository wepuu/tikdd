# ADR-0027: Fail-closed resolution-only runtime guard

- Status: accepted
- Date: 2026-09-09
- Scope: Worker completion and encrypted Delivery candidate persistence

## Context

TikDD keeps a development-only path for Providers that return normalized formats before Delivery
candidate persistence is wired. Production formats must have one encrypted candidate per public
format. The previous Worker default treated every `NODE_ENV` value other than the exact string
`production` as eligible for resolution-only completion. A missing or mistyped runtime environment
could therefore allow a succeeded task without a usable Delivery candidate.

The 2026-09-09 Instagram smoke reached one public MP4 format but failed when secure Delivery was
prepared. The later database inspection found no live candidate or ticket; because candidates live
for four minutes, the inspection could not distinguish expiry cleanup from a missing insertion.
Regardless of that ambiguity, a production misconfiguration must never make this class of failure
silent.

## Decision

`allowResolutionOnly` is true only when `NODE_ENV=development`. Any other value, including an unset
or unexpected value, follows the complete production-shaped candidate validation path and fails the
task if a format has no encrypted candidate. No Provider, host policy, redirect rule, or download
mode is broadened.

The Worker completion test suite covers the fail-closed branch. Local development remains able to
exercise resolution-only fixtures by explicitly passing the development setting in its harness.

## Consequences

- A mis-bound production Worker fails a task rather than exposing a misleading successful result.
- Existing production providers are unchanged and must continue returning complete candidates.
- The earlier Instagram smoke remains a documented candidate-lifecycle incident; this guard does not
  claim to identify whether that candidate was inserted and later expired. Work Item 26 subsequently
  closed with an encrypted candidate and verified non-zero Delivery transfer.
- Re-enabling any Provider still requires the existing owner authorization, exact rollout CAS update,
  and a fresh real browser Delivery check. This ADR does not authorize traffic by itself.
