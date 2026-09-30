# Work Item 122: Cobalt private runtime and OK.ru canary

## Scope

This work item validates the self-hosted Cobalt service from Work Item 121 before any
production traffic is enabled. The first platform is OK.ru because its existing free-provider
evaluations failed the portable-delivery gate. Vimeo and Pinterest remain follow-up secondary
candidate checks; X, Instagram, TikTok and Facebook are not activated by this work item.

The Cobalt gates stay closed during the runtime probe. The probe starts only the private
`cobalt-api` profile, verifies authenticated service discovery from inside the container network,
and never recreates the Worker or sends a public TikDD task.

## Release operation

Use the official release script with an explicit `TIKDD_RELEASE_ENV`:

```text
TIKDD_RELEASE_ENV=/etc/tikdd/production.env \
  sh scripts/production-release.sh cobalt-runtime-probe
```

The probe requires all three Cobalt gates to be `false`, checks the pinned image and Compose
health, authenticates with the Docker secret in-container, and verifies that the reviewed `ok`
service is advertised. It does not print the API key or Cobalt response. Use
`cobalt-runtime-stop` to release the service after a failed or deferred canary.

The production key must be a dedicated UUID key whose `allowedServices` contains only `ok` for
this first canary. The file is owned by `root:tikdd-secrets` with mode `0640`; the Cobalt
container receives only the dedicated supplementary secrets group. It must not be `unlimited`,
and it must not be copied into the Worker environment while the provider is disabled.

## OK.ru canary gates

Run one request for each of the two previously reviewed public samples, with a 15-second timeout
and at least ten seconds between requests. Do not retry or save sample URLs, response bodies,
media URLs, signed queries, cookies or tokens.

Each result must be a Cobalt `redirect` or `picker` with an HTTPS, public, non-credentialed
`*.okcdn.ru` MP4. Reject `tunnel`, `local-processing`, HLS-only, audio-only and Provider-page
results. The selected media must pass a 1 KiB Range probe from NL, the local client and the
local v2rayN exit. Browser delivery must either download or pass the existing client CORS-save
path; an inline-only response is `delivery-conditional` and cannot be activated.

## Activation boundary

Only after both samples pass all delivery gates may the release environment set:

```text
COBALT_APPROVED_PLATFORMS=odnoklassniki
COBALT_DELIVERY_VERIFIED_PLATFORMS=odnoklassniki
ENABLE_COBALT_PROVIDER=true
COBALT_LICENSE_ACKNOWLEDGED=true
COBALT_DELIVERY_AUDIT_APPROVED=true
```

Then recreate the Worker with the official `worker-config-apply` operation and CAS-enable the
single `cobalt-selfhosted / odnoklassniki / nl` rollout rule. OK.ru remains Experimental/Beta;
it is not added to sitemap or stable indexing in this work item.

Any failure leaves the gates closed and the rollout absent or disabled. Do not expand the OK.ru
host policy, add media proxying, accept Cobalt tunnels, or fall back to Provider-page handoff.
