# Work Item 91 — Instagram recovery and bounded fallback decision

## Status

Implementation complete on `codex/wi91-instagram-recovery`; production Instagram traffic is safely
disabled pending CI, exact-image deployment, and two browser downloads.

## Incident evidence

The production baseline was `main@5d479bd17af1a57594813e8f538ed69d3c200ab6`. All eight containers
were healthy and the SaveFromIns process gates were true. The exact rollout was enabled at full
allocation, so the incident was not a missing runtime binding.

The seven-day sanitized ledger contained six SaveFromIns attempts and no success: four
`invalid_result`, one `provider_timeout`, and one `provider_schema_changed`. In the latest 24-hour
window, two further Instagram tasks had no attempt because the circuit was cooling down. The exact
circuit reached 21 consecutive opens with its bounded 15-minute maximum cooldown. No recent
Instagram Delivery outcome existed, placing the failure before ticket creation.

The rollout was CAS-updated from revision 15 to revision 16, disabled with zero allocation. Audit
operator `codex.wi91` and snapshot revision 73 record the containment. Provider gates remain true;
other platform rules and services were not changed.

## Bounded protocol observations

One disabled-route SaveFromIns request was made from NL with a 10-second timeout and no retry. It
returned HTTP 200 JSON in 3.161 seconds, using the existing `data.resources` envelope. Two resources
were present; one was a direct MP4 on the already reviewed `fna.fbcdn.net` family and the unrelated
audio sibling was incomplete. Only structural types, enumerated classifications, counts, and the
reviewed host-family label were observed. No source URL, response body, title, request marker, or
complete media address was retained.

Two bounded SocialDownloader Instagram checks then evaluated whether an existing adapter could be
a secondary. The first returned HTTP 200 and its reviewed `/api/video` resource returned 206
`video/mp4` for a 1 KiB Range read. The second parse timed out at 10 seconds. It is therefore not
repeatable and remains `canary_failed`; no Instagram Delivery policy, runtime platform list, or
rollout rule is added.

## Implementation

- SaveFromIns explicit failure envelopes now map to their known content, access-friction, or
  availability classes instead of being mislabeled as schema drift.
- Successful observed envelopes accept an omitted `status_code` only when another success marker
  and a reviewed `data.resources` or `data.media[].resources` collection are valid.
- Missing or null quality normalizes to `Original`; malformed and irrelevant siblings remain
  isolated from valid direct MP4 resources.
- Internal diagnostics add bounded envelope variant, Provider outcome, resource path, and malformed,
  non-video, non-MP4, and non-direct rejection counts.
- Instagram queue jobs and SaveFromIns failures are single-attempt. There is no automatic timeout
  replay; future sequential fallback still occurs inside the router execution.
- Existing Delivery tickets, redirect validation, media policies, public contracts, database, and
  Admin UI are unchanged.

## Verification and release gate

Run focused Provider/retry/diagnostic tests, the full `pnpm check`, `git diff --check`, and production
Compose validation. Merge one PR and deploy only immutable GitHub images after the normal backup.

The revision-16 rule remains disabled during deployment. After the prior circuit observation window
has elapsed, CAS-enable that same rule and submit two distinct owner-authorized public Reels in
sequence. Each must create one attempt, one ticket, a reviewed 302, and a non-zero browser download.
The second sample is submitted only after the first succeeds and the half-open probe lease clears.

Any failure immediately returns the same rule to disabled/zero allocation. Two successes permit the
Instagram Beta to reopen, followed by a short health check and a first-10-distinct-task review. A
success rate below 70 percent closes the route and triggers a new free-Provider qualification batch;
it does not increase retry frequency or weaken the Delivery boundary.
