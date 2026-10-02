# Work Item 137: Cobalt planned-platform qualification

## Scope

Work Item 137 evaluates Dailymotion, Reddit and VK through the pinned self-hosted Cobalt runtime.
It does not enable a production route, change the production key registry, create a rollout rule,
publish a downloader page or alter an existing Provider. Source URLs, signed Tunnel descriptors,
response bodies and credentials remain temporary and are not committed.

The production Cobalt runtime advertised all three services. Its existing key intentionally allows
only the already reviewed services, so the first production-bound request returned
`error.api.service.disabled` for every sample. Rather than modifying that production credential,
the final batch used an isolated Cobalt container on the private Provider network with an independent
temporary key, no public port and the same pinned image digest.

## Sanitized result

- Dailymotion resolved both public samples as one `tunnel` candidate each. The adapter now recognizes
  Dailymotion as a fixture-verified Cobalt capability at priority 450 and accepts only the existing
  exact `cobalt-selfhosted-tunnel-media-v1` boundary. A direct `redirect` or `picker` result is rejected
  because no Dailymotion source-CDN Host policy has been reviewed.
- The isolated Cobalt instance could not redeem its descriptors through the production
  `media.tikdd.cc` origin. Both independent client exits reached the exact boundary but received
  HTTP 401 with zero media bytes. This is expected instance ownership, not proof of a broken source
  video. Dailymotion is therefore `delivery-blocked` until a separately approved production-key
  window repeats the Range, one-time Delivery and browser-save checks.
- The supplied Reddit and VK pages require an authenticated browser session. TikDD does not accept
  user Cookie, account or browser state, so both platforms are recorded as
  `blocked / browser_state_required`. Their Cobalt error envelopes are not treated as general
  evidence that public Reddit or VK media is unsupported.

`vkvideo.ru` is added as an explicit VK catalog host with a suffix-spoof regression test. VK remains
planned and has no eligible Provider route.

## Fail-closed implementation

The Cobalt qualification runner accepts at most two reviewed samples for each new platform and
retains its existing sequential, bounded and sanitized behavior. The Provider manifest exposes no
delivery mode for Reddit or VK. Dailymotion obtains `proxy` delivery only when an operator explicitly
configures the exact `dailymotion:tunnel` capability; the repository and production defaults do not
set it.

No public contract, database schema or media-delivery architecture changes. ADR-0059 and ADR-0060
already define the Tunnel and topology-aware qualification boundaries, so no new ADR is required.

## Remaining production gate

A later activation window must explicitly authorize `dailymotion` in the production Cobalt key,
force-recreate and authenticate the Cobalt container, then repeat both samples. Both client exits
must receive non-zero ranged video with exact CORS, attachment and private-cache semantics. TikDD
must then verify a one-time Delivery handoff and an owner browser save before creating the unique
`cobalt-selfhosted / dailymotion / nl` rollout rule. Until then Dailymotion stays planned,
non-indexable and absent from the sitemap.
