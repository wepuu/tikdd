# Work Item 125: Cobalt OK.ru delivery qualification and conditional Beta launch

## Scope

The Cobalt private runtime is healthy after Work Item 124, but that proves only the isolated
service and API-key wiring. This work item qualifies OK.ru delivery independently before any
Worker traffic, rollout rule, public page, SEO entry, or sitemap change. The baseline is
`main@c451f2d`.

The closed-gate runtime probe passed, but the first native sample returned an authenticated Cobalt
`status=error` response with no media candidate. The bounded canary did not retry and stopped
before the second sample. No Range, cross-exit or browser-save test could run. The resulting
qualification is `no-media`; Cobalt, its three gates and the OK.ru rollout remain disabled.

## Qualification gates

Use the two already reviewed public native OK.ru samples, one request per sample, a 15-second
timeout and at least ten seconds between requests. Do not retry, log source URLs, response bodies,
signed media URLs, cookies or tokens. Accept only Cobalt `redirect` or `picker` results whose
selected resource is an HTTPS progressive MP4 on a public `*.okcdn.ru` subdomain. Reject
`tunnel`, `local-processing`, HLS-only, audio-only, Provider-page and unsafe-host results.

For each sample, verify a 1 KiB Range response from NL, the local client and the local v2rayN
exit. The browser GET must either provide attachment semantics or pass the reviewed CORS-save
path. Inline-only media without CORS is not a production route. The final qualification requires
both samples, portable host policy, Range, cross-exit and browser-save evidence.

`packages/providers/src/cobalt-okru-qualification.ts` owns the sanitized evidence schema and
deterministic status assessment. It excludes all sample and CDN identifiers. The current record
has `runtimeProbePassed=true`, one attempted sample, zero resolved samples and a `no-media`
result. The private Cobalt container was stopped after the failure and all temporary files were
deleted.

## Conditional activation

Only after a future, separately justified upstream change lets both samples pass may the operator set `COBALT_DELIVERY_VERIFIED_PLATFORMS=odnoklassniki`
alongside the existing approved platform list, acknowledge the three Cobalt gates, and recreate
only the Worker through `worker-config-apply`. Then CAS-enable the unique
`cobalt-selfhosted / odnoklassniki / nl` rollout rule and perform two real browser downloads.
OK.ru remains Beta and non-indexed until a later productization decision. Vidomon remains
resolution-only and is not an implicit fallback.

Any failure disables the rollout first, then the Cobalt gates, and applies the closed Worker
configuration. Stop the private Cobalt profile after the canary. Do not add a media proxy, accept
Cobalt tunnels, expand the `*.okcdn.ru` boundary, or hand users to a Provider page.

## Validation

- Cobalt qualification tests cover the two-sample requirement, `*.okcdn.ru` delivery boundary,
  Range/cross-exit/browser-save gates, and blocked/deferred/no-media classifications.
- Delivery tests keep the existing `cobalt-selfhosted-okru-media-v1` policy on `navigate` with
  its reviewed `okcdn.ru` suffix; no new policy is created before browser evidence exists.
- Worker tests confirm an approved platform is not delivery-verified by default and all three
  gates remain closed.
- Targeted Vitest, `pnpm check`, `git diff --check`, PR CI and the official closed-gate runtime
  probe passed. The media canary failed before delivery, so production routing was not changed.
