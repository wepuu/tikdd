# X Production Evidence Gate — authorization packet

Status: **not authorized / not started** as of 2026-09-05.

This packet prepares the next operational decision. It is not itself permission to contact a
Provider, start calibration, create or increase a rollout grant, start Admin, or publish/index X.

## Current verified baseline

- Production release: `3a359ce02372cbb1a2db27cb5d228dbb9ed158d2`.
- WI17 Canary, evidence, and cleanup timers have recurring production proof.
- The only scheduled Provider tuple is `ssstwitter/x/canary-global` through
  `ssstwitter-x-recurring-001`.
- Worker Provider flags and public rollout remain disabled.
- WI18 is deployed but Admin is stopped; no calibration or pilot record was created by deployment.
- `config/x-pilot-evidence.json` currently names both `twittersaver` and `ssstwitter`, while the
  recurring Canary allowlist contains only SSSTwitter. This scope mismatch must be resolved before
  calibration begins.

## Decision required from the owner

Authorize one exact calibration scope, including Provider, platform, concrete region, approved
observation class/cohort, bounded cadence/concurrency, start and stop time, and emergency stop
owner. The recommended first decision is a single reviewed tuple, not an implicit two-Provider
program. `canary-global` technical health must not be substituted for `nl` calibration evidence.

The authorization must also say whether the evidence index will:

1. remain a two-Provider gate, which requires separate complete calibration and later pilot evidence
   for both TwitterSaver and SSSTwitter; or
2. be reviewed and narrowed in a separate code change to the selected production Provider before
   evidence collection.

## Proposed bounded sequence after explicit authorization

1. Capture preflight truth: release, flags, rollout rules, guard, circuit, WI17 freshness, exact
   qualification revision, and approved Canary/test tuple.
2. Start exactly three consecutive sealed UTC internal calibration days for the authorized
   Provider/X/region tuple. Any incomplete day restarts the consecutive window.
3. Present the evidence-backed policy proposal in WI18; the owner reviews and locks the exact
   proposal/revisions. No rollout grant is created by policy lock.
4. Request a separate staged-pilot authorization defining the exact allocation, cohort, expiry,
   concurrency, rollback trigger, and observation window.
5. Run seven consecutive healthy sealed daily reviews under the existing deny-first rollout,
   restrictive guard, circuit, Delivery, and cleanup boundaries.
6. Perform one separately authorized owner/browser end-to-end verification on the intended
   production route, then reconcile all evidence in the final review.

## Mandatory stop conditions

Stop and hold the tuple on missing/stale WI17 services, stale or failed Canary/evidence, incomplete
daily samples, Delivery validation failure, guard hold/reduce/deny, open/stale circuit, release or
configuration drift, scope mismatch, or any unauthorized Provider/URL/region observation.

Only an explicit owner rollout action may create or increase allocation. Time passing, green CI,
catalog recognition, a closed circuit, or a successful isolated Canary cannot complete the gate.
