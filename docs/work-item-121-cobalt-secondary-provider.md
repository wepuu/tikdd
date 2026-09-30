# Work Item 121: self-hosted Cobalt multi-platform secondary Provider

## Scope

This work item introduces an isolated Docker deployment and a fail-closed adapter for Cobalt's
official API protocol. Initial technical scope is OK.ru, X, Instagram, TikTok, Facebook, Pinterest,
and Vimeo. YouTube and xHamster remain disabled. No production rollout rule or public platform page
is created by the implementation itself.

## Implementation

- `cobalt-api` is profile-gated, private to `provider-egress`, pinned to the amd64 digest of the
  official Cobalt 11 image, and constrained to 512 MiB/1 CPU/128 PIDs.
- The Worker sends one authenticated JSON request with `downloadMode=auto`, `alwaysProxy=false`,
  and a 15-second timeout. API keys are Docker secrets and never enter public results or logs.
- `redirect` and `picker` responses become normalized MP4 redirect candidates. `tunnel`,
  `local-processing`, audio-only resources, malformed URLs, and unknown response shapes are rejected.
- The seven versioned Delivery policies are registered but no platform is delivery-verified by
  default. Each policy is enabled only after direct CDN, public DNS, cross-exit, and browser GET
  evidence is recorded.

## Gates and validation

The production gates are `ENABLE_COBALT_PROVIDER`, `COBALT_LICENSE_ACKNOWLEDGED`, and
`COBALT_DELIVERY_AUDIT_APPROVED`; all default to `false`. `COBALT_APPROVED_PLATFORMS` lists the
technical portfolio, while `COBALT_DELIVERY_VERIFIED_PLATFORMS` is intentionally empty. The release
script binds both lists into the Worker and rejects mismatches. This work item requires adapter
fixtures, error-decision tests, routing tests, Compose validation, `sh -n scripts/production-release.sh`,
`git diff --check`, and `pnpm check`.

The Cobalt key file follows the upstream UUID-keyed JSON schema. The UUID supplied as
`COBALT_API_KEY` in the mode-600 production environment file must be the same key used in the
corresponding `/etc/tikdd/secrets/cobalt_api_keys` object, whose `allowedServices` list contains
only the reviewed services. Do not set a key to `unlimited` until resource and abuse limits have
been observed. The key remains unset when Cobalt is disabled, so existing deployments do not need
to create a new secret file before this profile is approved.

## Follow-up

The next work item should run a bounded NL canary for one platform at a time. It may add a rollout
rule only after two public samples and a user-exit browser download succeed. If Cobalt emits only
Provider tunnels or local processing, the platform stays deferred; TikDD will not add a media proxy.
