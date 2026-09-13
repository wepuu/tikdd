# Work Item 53 — Technical free-Provider qualification

Status: implementation in progress; no production rollout or new traffic (2026-09-13).

## Scope

This batch replaces page-copy screening with a technical evidence model. Each candidate records
whether its transport is reachable, whether its protocol has resolved a normalized MP4, and whether
it is blocked or returned no media. Marketing text is never used as a capability or compliance
decision. Live checks are manual, bounded, and run from the NL VPS; no raw URL, response body,
cookie, credential, or CDN URL is written to diagnostics.

## Observations

| Candidate | Technical state | Interpretation |
| --- | --- | --- |
| TikCD (`tikcd`) | `resolved` | `tikwm.com/api` returned structured success for the supplied TikTok sample; `play/hdplay` were TikTok CDN MP4 URLs and a range request returned `206 video/mp4`. |
| TokVid (`tokvid`) | `reachable` | Landing transport is reachable; no protocol submission evidence yet. |
| GramSnap (`gramsnap`) | `reachable` | Landing transport is reachable; the client-side request flow still needs an isolated protocol fixture. |
| TikVid.io (`tikvid-io`) | `blocked` | NL request received a Cloudflare challenge. |
| SaveVid (`savevid`) | `blocked` | NL request received a Cloudflare challenge. This is not a public-content policy rejection. |
| TikVid (`tikvid`) | `no-media` | Existing Work Item 52 sample flow returned no valid MP4. |
| SnapInsta (`snapinsta`) | `blocked` | Existing Work Item 52 landing request received a challenge. |

## Implementation

- Added `technicalState` to the offline candidate matrix and qualification reasons.
- Added the bounded `provider:preflight` diagnostic command; it performs no user URL submission.
- Added a disabled TikCD API adapter with strict JSON parsing and opaque redirect candidates.
- Added exact API host validation for `tikwm.com` and a reviewed TikTok CDN suffix policy for
  `tiktokcdn-us.com`. The adapter manifest has `deliveryModes: []`, so production cannot call it.
- Added independent TikCD terms and delivery-audit gates, both defaulting to false.

## Next gate

Collect additional TikCD fixtures, verify the CDN host policy with a second public sample, and
complete one browser Delivery check. Only then may a single secondary rollout rule be proposed.
Existing X, Instagram, Admin, and calibration runtime state is unchanged.
