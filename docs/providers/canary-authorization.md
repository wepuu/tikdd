# Live provider canary authorization

- Current configuration assertion date: 2026-08-04
- Asserted by: TikDD project owner
- Scope: only the exact provider/platform/URL tuples enumerated in
  `config/provider-canaries.json` are authorized for bounded technical testing
- Evidence status: project-owner attestation; external legal evidence is not stored in this repository
- Data handling: the runner does not persist provider responses, page metadata, thumbnails, or media
  URLs and emits only provider status, normalized format count, failure code, and elapsed time

This record authorizes a bounded technical canary. It is not a blanket authorization to download
other content, bypass access controls, supply user cookies, or enable either provider in production.

Run all canaries from PowerShell:

```powershell
$env:TIKDD_CANARY_AUTHORIZED = "true"
pnpm canary:providers
```

Set `CANARY_ID` to one configured ID to run exactly one authorized tuple. `CANARY_PROVIDER` may
select every configured tuple for one provider; when both filters are present they are intersected,
never unioned. The explicit environment acknowledgement prevents an accidental network call during
ordinary tests and CI.

Do not reuse an authorized URL with another provider unless that exact new tuple has been added to
the configuration after an explicit project-owner assertion. In particular, the existing
TwitterSaver/X authorization does not by itself authorize a DLPanda/X request.

## Consumed one-time DLPanda/X authorization

On 2026-08-10 the project owner separately authorized `dlpanda-x-authorized-001` for exactly one
direct technical canary that did not download media, follow media links, retry through another
provider, or bypass a challenge. The run returned `provider_challenge` after 1,467 ms. No media host,
candidate, redirect, or content was requested or recorded.

The tuple was removed from `config/provider-canaries.json` immediately after the run so the
one-time authorization cannot be reused. This historical record does not authorize another request.

## SSSTwitter/X authorization

On 2026-08-10 the project owner authorized the exact `ssstwitter-x-authorized-001` tuple for bounded
technical testing, then separately authorized one corrected-parser repeat. Both runs fetched the
public SSSTwitter form and submitted the same configured public X URL without following or
downloading media links, supplying account credentials, bypassing a challenge, or enabling
production traffic.

The first run exposed a page-scope parser defect and was excluded from qualification evidence. The
corrected repeat succeeded with two normalized formats, one parsed hostname (`ssscdn.io`), and a
4,931 ms duration. The exact tuple was then removed from executable configuration so no third run is
authorized implicitly. Future live canaries require a new explicit assertion.

### Consumed SSSTwitter delivery-audit authorization

On 2026-08-10 the project owner separately authorized one delivery-audit run for the same
SSSTwitter/X combination. Its scope allowed one fresh page resolution and at most one `HEAD` request
for each of two candidates, with manual redirects and no media `GET`, download, redirect following,
or challenge bypass.

The page-resolution phase returned `provider_unavailable` after 15,830 ms. No candidate was created,
so the runner issued zero media `HEAD` requests and recorded no media headers or redirect host. The
one-time authorization was consumed and its tuple was immediately removed from executable
configuration. This result does not establish media redirect, MIME, required-header, or lifetime
behavior and does not authorize a retry.

The project owner then explicitly requested one retry under the same limits. That second run also
failed during page resolution as `provider_unavailable`, after 13,923 ms. It likewise created no
candidate and issued zero media `HEAD` requests. The retry authorization was consumed, its temporary
tuple was removed, and no third external request is authorized by this record.

After confirming the local v2rayN listener, the project owner authorized one additional retry under
the same request limits through `127.0.0.1:10808`. The run succeeded in 3,539 ms with two normalized
formats and the single candidate hostname `ssscdn.io`. Exactly two media `HEAD` requests were sent,
one per candidate. Both returned status 200 with no redirect and `application/octet-stream`; their
declared lengths were 2,100,269 and 1,040,035 bytes and their durations were 1,441 and 1,032 ms.
No media `GET`, body download, redirect following, credential forwarding, or challenge bypass
occurred. The temporary tuple was removed immediately after the run. This authorization is consumed.

### Consumed SSSTwitter lifetime-audit authorization

On 2026-08-10 the project owner authorized one proxy-path lifetime audit for the same exact
SSSTwitter/X combination. The runner resolved the page once, selected one `ssscdn.io` candidate,
and sent exactly two manual-redirect `HEAD` requests: immediately and after 240,000 ms. Both returned
200, no redirect, `application/octet-stream`, and the same declared length of 2,100,269 bytes. Their
durations were 1,332 and 1,012 ms. No media `GET`, response body transfer, redirect following,
credential forwarding, or challenge bypass occurred.

The run completed in 244,026 ms. Its temporary tuple was removed immediately and the authorization
is consumed. This evidence supports a four-minute maximum internal candidate lifetime for the
observed redirect policy; it does not authorize production traffic or another live request.

## Consumed work item 11.2 product-journey authorization

On 2026-08-10 the project owner authorized the exact public X URL
`https://x.com/Xiaoniu6161/status/2086495430360334558?s=20` for the work item 11.2 Product Design
journey. Scope allowed submission to TwitterSaver and SSSTwitter with bounded priority fallback,
creation of short-lived delivery tickets, one real browser download handoff, natural expiry, and
regeneration. Account cookies, private content, challenge bypass, and access-control bypass were
forbidden.

The journey issued two real resolutions because the first candidate expired during state capture.
TwitterSaver succeeded first in 3,408 ms and 931 ms, so SSSTwitter was not contacted and live
fallback was not manufactured. Three redirect tickets were created; two expired unused and the
final ticket was redeemed once by the browser. No provider response, direct media URL, secret
header, cookie, or media body was stored in the audit. This authorization is consumed and does not
authorize another live request.

To verify priority routing and fallback without persisting provider responses, add:

```powershell
$env:CANARY_MODE = "routing"
pnpm canary:providers
```

Routing mode enables the two reviewed site adapters and keeps the development mock last. Its output
lists only provider IDs, attempt status, and normalized failure codes, making the fallback path
observable without exposing media data.

The scheduled production-style path is `pnpm canary:start`. It additionally requires an isolated
`canary-*` region plus affirmative audited rollout, circuit, and distributed concurrency controls.
See [canary-operations.md](../canary-operations.md). The manual command above remains for bounded
feasibility checks and is never started by `pnpm dev` or CI.
