# Work Item 26 — Instagram Beta reliability closure

Status: complete (2026-09-09 closeout); SaveFromIns/Instagram Beta is enabled at full allocation.

The owner-supplied Reel `DcSBz8UCbTG` was re-tested through the public browser flow on 2026-09-09.
The closeout completed resolution, secure Delivery, and a non-zero MP4 transfer. Earlier failed
attempts remain documented below as historical diagnostics.

## Initial baseline (historical)

- Code checkpoint: `main@15e9ed4448cbb29f781c332494c1ae7f3648ca90`.
- PR #64 remains deployed from GitHub-built immutable Web, Service, and Admin images.
- SaveFromIns/Instagram/NL was disabled after the failed smoke. Admin, calibration, and all other
  Providers remain disabled; X remains enabled at full allocation.
- The adapter already handles sparse resource arrays and empty video quality (`Original`).
- The post-deploy smoke on 2026-09-08 produced one terminal `content_not_found` attempt for
  `DZxoImOOKr` and one `invalid_result` attempt for a previously successful Reel; it produced no
  new successful Instagram transfer.

## Bounded implementation

1. Reproduce one currently public Reel verified in a browser. Record only the sanitized response
   shape, normalized platform, and Provider attempt code. Do not retain media URLs, cookies,
   request markers, tracking parameters, or raw upstream bodies.
2. If the response contains a trusted direct MP4, add the exact redacted fixture plus adapter,
   routing, and Delivery-host regression coverage. Keep response-count, timeout, retry, SSRF,
   redirect, and host-suffix policies unchanged.
3. If no trusted direct MP4 is returned or the Provider is repeatedly challenged, stop adapter
   patching and open a separate Provider-replacement feasibility item. Do not add cookies,
   challenge bypasses, runtime host discovery, or new download modes.
4. Release through the existing MVP loop: targeted tests, `pnpm check`, PR CI, GitHub immutable
   images, encrypted production backup, manual deployment, one real Instagram transfer, and a
   15-minute health watch.

## Failure and rollback

If the real transfer or a core health gate fails, first CAS-update the exact
`savefromins / instagram / nl` rollout rule to `enabled=false` and `allocationBps=0`, then close
the three SaveFromIns gates. X remains unchanged. Roll back the application image only for a
version-wide failure, using the prior recorded release and backup.

## Exit criteria

- One current public Reel resolves to a direct MP4 under the existing allowlists.
- Delivery returns a non-zero video response and the browser flow completes.
- Core services remain healthy with no material 5xx or circuit-open event during the short watch.
- The release record contains the GitHub image digests, backup, sanitized attempt, and observation
  window without claiming stable Instagram support.

Until all criteria are met, Instagram remains experimental and noindex. This item does not start
Admin or calibration and does not activate another Provider.

## 2026-09-09 production smoke and fail-closed action

The public Reel shortcode `DcSBz8UCbTG` was confirmed publicly reachable in a browser. The TikDD
Web flow reached `Formats ready` with one normalized `MP4 Original Video + audio` format. `POST
/v1/deliveries` then returned the generic `DELIVERY_CANDIDATE_NOT_AVAILABLE` response
(`This format is not available for secure delivery.`).

The sanitized database record was task `tsk_05ba41228c4249ecab382ebfd06333c4`: one successful
`savefromins` / `instagram` / `nl` Provider attempt, one public format, and zero delivery tickets
when inspected. The candidate row may have expired before inspection because the adapter's
candidate lifetime is four minutes; the evidence therefore does not distinguish an insertion
followed by expiry from a missing insertion. It does prove that the browser journey did not reach
Delivery success.

The exact rollout rule was CAS-updated from revision 9 to disabled revision 10 with zero
allocation. `ENABLE_SAVEFROMINS_PROVIDER`, `SAVEFROMINS_TERMS_APPROVED`, and
`SAVEFROMINS_DELIVERY_AUDIT_APPROVED` were set false in the versioned production environment and
the Worker was recreated. The global rollout guard remains true, the SSSTwitter/X rule remains at
revision 15 and full allocation, and all six core containers stayed healthy.

The follow-up code adds a fail-closed Worker default: resolution-only output is allowed only when
`NODE_ENV=development`; an unset or unexpected runtime value can no longer silently persist a
succeeded task without encrypted Delivery candidates. This is a guardrail, not proof that the
upstream response itself was malformed. A new qualification attempt requires explicit owner
authorization after targeted tests and GitHub CI pass.

The owner also reports successful Instagram downloads for other URLs from desktop and mobile
clients. That observation supports keeping SaveFromIns as the current candidate, but it is not a
TikDD production transfer record and does not by itself reopen the disabled rollout rule.

## 2026-09-09 controlled re-test after CI (historical failure)

After PR #66 CI passed, the same canonical Reel was retried once under a fresh backup and a
temporary enablement of the exact rule. Instagram remained publicly reachable in the browser, but
the SaveFromIns request exceeded the 15-second Provider timeout. The sanitized task ended as
`PROVIDER_UNAVAILABLE` with one `provider_timeout` attempt and no public formats, so no Delivery
ticket or media transfer was attempted.

The rule was immediately CAS-disabled from revision 11 to revision 12 and the three SaveFromIns
gates were set false in the versioned production environment. The rollback backup was
`/var/backups/tikdd/p0-dr-01/production.36d967b575d0edcf7cce394c2bfeceaebb75a91f.env.wi26-retest-rollback-20260909T034442Z`
with SHA-256
`7d1ac8e117fe6d6335ad437df1ea94917aee40e86e4310f5083ff462689095bb`. The Worker was recreated and
reported healthy; all six core containers remained healthy. This second failure confirms
intermittent upstream availability/latency for this sample, not a deterministic Delivery-candidate
shape defect. SaveFromIns remains experimental and production-disabled pending a provider-side
reliability decision.

## 2026-09-09 production closeout

After the follow-up authorization, production was deployed from the GitHub merge
`main@9ce4565f1f4afa44733f2a70a0a97b7b61a7150f`. The exact `savefromins / instagram / nl` rule was
CAS-updated to revision 13, `enabled=true`, and `allocationBps=10000`; the three SaveFromIns gates
were true, while `PROVIDER_PILOT_GUARD_REQUIRED=false`. X stayed on its existing revision 15 rule.
Admin, calibration, and all other Providers remained stopped or disabled.

The production release used immutable GitHub images: Service digest
`sha256:fa045bcc2d5019dc691818dd99c4796391b3b0c9eebc842b697c06d5126cb257` and Web digest
`sha256:d036493949f8fca32088633782bb28e87bf706fc017edbd8f3016d69a9526f6d`. The encrypted
PostgreSQL backup was `/var/backups/tikdd/p0-dr-01/tikdd-prod-20260909T040507Z.dump.gpg` with
SHA-256 `b851088543437e04681f5167da78dae274ace550d6b601f496d358bf7770900d`.

The public Reel `DcSBz8UCbTG` completed the browser journey. Delivery returned HTTP 200 with
`content-type: video/mp4`, `content-length: 4476966`, and a non-zero ISO MP4 body. The six core
containers remained healthy with zero restarts and no observed API 5xx during the 15-minute
observation recorded at `/var/backups/tikdd/p0-dr-01/wi26-instagram-observation-20260909T052000Z.log`
(SHA-256 `2a0e94878bb94d04a6ceddfd1613d74336fac4eb4a46f5aa55d71d29211fb102`). This closes the
reliability item without promoting Instagram beyond Beta/noindex.
