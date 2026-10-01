# Work Item 129: Cobalt multi-mode delivery architecture

## Scope

Work Item 129 implements the protocol boundary for Cobalt `redirect`, `picker`, `tunnel`, and
`local-processing` responses. It does not enable Cobalt or change a production rollout rule.

## Implementation

- The Cobalt adapter normalizes mixed video, audio, image, and GIF picker entries; signed tunnel
  results; and local merge, mute, audio, GIF, and remux plans.
- Platform activation moves from one boolean delivery list to the mode-specific
  `COBALT_DELIVERY_VERIFIED_CAPABILITIES` map. The legacy list remains compatible and grants only
  `redirect|picker`.
- Two versioned Delivery policies constrain the exact `media.tikdd.cc/tunnel` descriptor. The
  processing policy returns a one-time JSON plan; the ordinary tunnel policy redirects the browser.
- The Web app uses pinned libav.js remux/encode builds for local processing, with a 200 MiB combined
  input ceiling and 120-second deadline. Media bytes travel between the user's browser and Cobalt.
- The production Cobalt profile publishes port 9000 only on host loopback. Host Nginx exposes only
  `/tunnel`, while Cloudflare Tunnel maps `media.tikdd.cc` to the existing Nginx loopback origin.

## Closed-by-default rollout

Every platform begins closed for new modes. Before adding a capability, verify two public samples,
the exact result mode, descriptor expiry, browser CORS or navigation behavior, output integrity,
resource use, and sequential fallback order. Existing stable Providers retain their higher priority.
Do not enable a mode merely because Cobalt lists the service.

## Completion criteria

- Contracts and OpenAPI describe media kinds and client processing.
- Adapter, policy, Delivery, Worker activation, and Web processing tests cover all modes and reject
  malformed, expired, cross-host, extra-query, oversized, or replayed inputs.
- Compose and Nginx validation prove the API is private and only `/tunnel` is public.
- `pnpm check`, Compose configuration validation, shell validation, and `git diff --check` pass.
- Production gates and traffic remain unchanged until a later, separately approved rollout.
