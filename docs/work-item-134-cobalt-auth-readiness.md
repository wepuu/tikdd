# Work Item 134: Cobalt authenticated readiness and fail-closed release binding

## Scope

Work Item 134 repairs the production-readiness gap exposed by the failed Work Item 133 Cobalt-only
TikTok browser window. It does not grant Cobalt traffic, add a platform, change public contracts or
alter media delivery. The production `cobalt-selfhosted / tiktok / nl` rollout remains disabled at
allocation zero until a later approved activation.

## Confirmed root cause

Two browser tasks selected only `cobalt-selfhosted` and failed before media resolution. Their
sanitized attempt ledger recorded Cobalt HTTP 400 with `provider_unavailable`; a bounded internal
replay returned `error.api.auth.key.not_found`. The Cobalt container log then identified the
configuration fault: the mounted key registry used unsupported singular field `userAgent`.
Cobalt 11.7.1 accepts `userAgents`, so it rejected the registry and loaded no API keys.

The release process had considered an unauthenticated `GET /` discovery response sufficient for
runtime health and did not force-recreate the existing Cobalt container after a secret update.
Worker gates could therefore be enabled while authenticated Cobalt requests were guaranteed to
fail. Matching key-file hashes did not prove that the running Cobalt process had accepted the
registry.

## Implementation

The new `cobalt-auth-readiness` preflight validates the key registry before making a request:

- the registry contains exactly the configured lowercase UUID key;
- only Cobalt's reviewed `name`, `ips`, `userAgents`, `limit` and `allowedServices` fields exist;
- `userAgents` is an array containing exact value `TikDD/cobalt-secondary`;
- malformed, duplicate, oversized or unknown values fail closed;
- the target is exactly the private Compose URL `http://cobalt-api:9000/`.

The probe submits an authenticated `POST /` with only the deliberately invalid URL
`https://example.invalid/`. Readiness succeeds only when Cobalt returns HTTP 400 with the expected
link-invalid or link-unsupported error. This proves registry loading, API-key authentication and
User-Agent matching without contacting an upstream media Provider. Logs expose only the status and
sanitized error code; the registry, key, response body and request headers are never printed.

The official release flow now force-recreates Cobalt before Worker creation whenever Cobalt is
enabled. It runs authenticated readiness immediately afterward and stops Cobalt with a failed
release exit if readiness does not pass. The same boundary applies to deploy,
`worker-config-apply`, runtime probe, qualification and Tunnel-audit operations. Worker recreation
cannot occur before successful Cobalt readiness.

## Tests

Provider-preflight tests cover valid schema, the rejected `userAgent` spelling, key mismatch,
secret-safe errors, authenticated POST success, authentication failure and rejection of a public
API origin. Release tests cover forced recreation, the one-shot readiness service, stop-on-failure
behavior, ordering before Worker recreation and Compose isolation.

No database migration, public API change or new ADR is needed. ADR-0058 through ADR-0060 continue
to define the private runtime, multi-mode delivery and topology-aware qualification boundaries.

## Production requalification procedure

Production remains fail-closed after this code is merged. A later approved release must:

1. back up PostgreSQL, the active release environment, key registry and release manifest;
2. atomically install a mode-600 registry using `userAgents: ["TikDD/cobalt-secondary"]`, the exact
   environment key and only reviewed service IDs;
3. deploy the exact GitHub image while keeping the Cobalt rollout disabled at allocation zero;
4. use the official release operation to force-recreate Cobalt and pass authenticated readiness
   before Worker recreation;
5. repeat the two bounded TikTok qualification samples and the reviewed Tunnel audits;
6. request separate approval for a temporary Cobalt-only browser window, then restore SnapTik and
   TikCD regardless of its result;
7. enable Cobalt as a priority-450 fallback only when the attempt ledger proves an actual Cobalt
   success and the browser download completes.

If any check fails, keep or CAS-set the Cobalt rollout to disabled/allocation zero, close its three
gates, apply the Worker configuration through the official script and stop Cobalt. Do not expand
the public media edge, weaken authentication or add TikDD media-byte forwarding.
