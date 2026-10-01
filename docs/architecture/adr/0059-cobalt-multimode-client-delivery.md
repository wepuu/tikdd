# ADR-0059: Cobalt multi-mode client delivery

## Status

Accepted for Work Item 129. This supersedes ADR-0058 only where ADR-0058 rejected Cobalt `tunnel`
and `local-processing` results. It does not authorize a production rollout by itself.

## Context

Cobalt can return four successful result shapes: `redirect`, `picker`, `tunnel`, and
`local-processing`. Rejecting the latter two makes otherwise supported services unusable, notably
when a source cannot be replayed from a different network exit or when audio and video must be
combined. Sending those bytes through TikDD Delivery would violate its one-time credential and
redirect boundary and would concentrate media traffic on the NL VPS.

The upstream implementation signs tunnel descriptors with `id`, `exp`, `sig`, `sec`, and `iv` and
serves them at `/tunnel`. Its local-processing response describes browser-side remux or encoding
work and supplies signed tunnel inputs. `TUNNEL_LIFESPAN` is expressed in seconds.

## Decision

- Keep the authenticated Cobalt API private on the Docker `provider-egress` network.
- Publish only the exact `/tunnel` path at `https://media.tikdd.cc`. All other paths and methods
  return 404/403. Access logs omit query strings; responses are private/no-store and non-indexable.
- Treat Cobalt's tunnel as a provider-owned, explicitly bounded media transport—not as a TikDD
  Delivery proxy. TikDD Delivery validates the versioned policy and issues a one-time handoff but
  never reads or forwards media bytes.
- Accept only HTTPS tunnel descriptors on the exact host and path, with the exact five query keys,
  strict value shapes, an unexpired timestamp, and at most 330 seconds of remaining lifetime.
- Normalize all four Cobalt result types. `redirect` and direct `picker` entries keep the existing
  reviewed source-CDN policies. Tunnel entries use `cobalt-selfhosted-tunnel-media-v1`.
- For `local-processing`, encrypt the complete processing plan in the delivery candidate. On ticket
  redemption Delivery validates every input, resolves every host to public addresses, and returns
  the plan once. The browser downloads inputs from `media.tikdd.cc`, runs the pinned libav.js remux
  or encode build, and saves the output locally. TikDD servers never receive those bytes.
- Bound browser processing to eight inputs, 200 MiB combined input, and 120 seconds. Do not add a
  Service Worker, File System Access dependency, persistent media storage, or server-side FFmpeg.
- Configure Cobalt tunnel lifetime to 300 seconds and use a dedicated public `API_URL`. The tunnel
  endpoint has a separate request budget and CORS is restricted to the TikDD Web origin.
- Replace the platform-only delivery approval with per-platform mode capabilities. A platform is
  eligible only for explicitly audited modes in `COBALT_DELIVERY_VERIFIED_CAPABILITIES`.
- Cobalt stays below an existing stable Provider in manifest priority. Tunnel and local-processing
  never displace a healthy primary route; fallback remains sequential and bounded.

## Consequences

TikDD can use the complete Cobalt protocol without exposing the private API or turning Delivery into
a general proxy. Users pay the bandwidth and browser CPU cost for tunnel/local-processing results.
Older browsers or low-memory devices can fail client processing; that failure does not cause an
automatic server-side fallback or a repeated Provider request. Each platform/mode combination still
needs a separate production delivery audit, gate update, and rollout approval.
