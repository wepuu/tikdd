# ADR-0021: Reviewed delivery host suffixes

Status: Accepted — 2026-09-06

Superseded in part by ADR-0022 for new SaveFromIns candidates. Version 1 retains this decision's
original `cdninstagram.com`-only boundary.

## Context

TikDD Delivery policies previously allowed only exact media hosts. SaveFromIns returned direct
Instagram media from two different hosts for two reviewed public Reel samples:
`scontent-bos5-1.cdninstagram.com` and `scontent-iad3-1.cdninstagram.com`. Treating those observed
edge names as a complete allowlist would fail when Instagram selects another CDN point of presence.
Accepting arbitrary Provider-returned hosts would instead turn Delivery into a general proxy.

## Decision

- A code-reviewed Delivery policy may contain exact hosts and/or explicitly reviewed DNS suffixes.
- Suffix matching requires a label boundary: a target must end with `.` plus the reviewed suffix.
  The bare suffix and lookalikes such as `cdninstagram.com.example.test` remain rejected.
- SaveFromIns is limited to real subdomains of `cdninstagram.com`; no other suffix is inferred from
  a Provider response.
- HTTPS validation and redemption-time public DNS validation remain mandatory. Provider request
  hosts continue to use exact allowlists.
- Adding or broadening a suffix is a code-reviewed Delivery boundary change with spoofed-host and
  private-network tests. Runtime/Admin configuration cannot add suffixes.

## Consequences

The production-disabled Instagram adapter can tolerate CDN edge rotation without trusting arbitrary
hosts. A compromised Provider response still cannot select an unrelated domain, a deceptive suffix,
or a private destination. Browser-followed redirects after a redirect-mode handoff remain outside
TikDD's proxy boundary, so qualification must continue to verify that reviewed candidates do not
redirect unexpectedly.
