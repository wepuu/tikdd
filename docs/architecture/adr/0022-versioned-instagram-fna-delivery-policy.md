# ADR-0022: Versioned Instagram FNA delivery policy

Status: Accepted — 2026-09-06

## Context

ADR-0021 limited SaveFromIns redirect candidates to real subdomains of `cdninstagram.com`. During
the first Work Item 22 production qualification, an owner-supplied public Reel resolved through
SaveFromIns but returned its MP4 candidate from `instagram.fsjc1-4.fna.fbcdn.net`. TikDD correctly
rejected that candidate, recorded three sanitized `invalid_result` attempts, created no Delivery
candidate, and disabled the rollout rule and Provider gates.

A subsequent disabled-route diagnostic confirmed that both owner-supplied Reels still resolve with
HTTP 200 and one direct 720P MP4 each. One used the existing `cdninstagram.com` family and the other
used the `fna.fbcdn.net` family. The new host resolved only to public IPv4 and IPv6 addresses. A
bounded 1 KiB HTTPS Range request returned HTTP 206, `video/mp4`, an 8,656,415-byte total length, an
ISO Base Media File signature, and no redirect. Its current TLS certificate identifies Meta
Platforms, Inc. and covers the observed point-of-presence hostname.

Pinning the single observed `fsjc1-4` hostname would fail when the CDN rotates points of presence.
Allowing all of `fbcdn.net` would be broader than the evidence and would include unrelated sibling
host families.

## Decision

- Keep `savefromins-instagram-media-v1` registered with only `cdninstagram.com` for compatibility
  with any unexpired candidate created by older code.
- New SaveFromIns candidates use `savefromins-instagram-media-v2`.
- Version 2 permits only real subdomains of `cdninstagram.com` and `fna.fbcdn.net`.
- The bare suffixes, concatenated lookalikes, suffixes followed by another domain, and other
  `fbcdn.net` siblings remain rejected.
- HTTPS validation and redemption-time public DNS validation remain mandatory. Redirect mode still
  emits only the reviewed handoff and never turns TikDD into a general proxy.
- Provider responses cannot extend this list at runtime. Any additional host family requires new
  bounded evidence, code review, and spoofed-host tests.

## Consequences

The adapter can tolerate the two currently observed Instagram CDN families while retaining a
label-boundary allowlist. Existing version 1 candidates keep their original, narrower semantics;
new candidates explicitly carry version 2. This change only repairs the code-owned Delivery
boundary. It does not authorize Provider traffic or change the disabled production rollout state.
