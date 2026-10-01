# Work Item 131: Cobalt Tunnel topology qualification

## Scope

Work Item 131 corrects the qualification boundary exposed by Work Item 130. It does not enable
Cobalt, change its production key, start public traffic, or approve browser local-processing.
TikTok remains the only conditional Cobalt production candidate.

## Implementation

The Cobalt evidence model now records delivery topology and separate resolver, direct-client,
proxied-client and origin-hairpin observations. Direct source-CDN results still need all three
portable exits. Tunnel results use the two independent client exits plus the reviewed tunnel
boundary; an origin host calling its own Cloudflare-fronted hostname is retained as diagnostics but
does not stand in for source-CDN portability.

Production eligibility remains stricter than transport probing. It also requires:

- the existing versioned Host policy and non-zero media Range;
- a successful standard one-time TikDD Delivery handoff;
- a real browser save using the approved attachment or CORS mode;
- no browser state, Provider page, source-IP binding or temporary failure.

The WI130 TikTok evidence therefore moves from the obsolete `proxy-only` label to
`resolved-conditional`. Direct and v2rayN user exits and the tunnel boundary passed, but the formal
handoff and browser-save fields remain false. The public-origin 403 stays `blocked-unclassified`
until Cloudflare request metadata is correlated with the query-free Nginx access log. All Cobalt
production gates and capabilities remain closed.

## Tunnel audit operation

`cobalt-tunnel-audit` consumes `/run/tikdd/cobalt-tunnel-audit-input.json`. The input contains one or
two short-lived signed descriptors, must be owned by UID `1000` with mode `600`, and identifies the
actual execution exit as `client-direct`, `client-proxy`, or `origin-hairpin`.

The operation:

- validates each descriptor against `cobalt-selfhosted-tunnel-media-v1` before network access;
- uses GET with `Range: bytes=0-1023`, exact Web `Origin`, no credentials and no redirects;
- reads at most 1 KiB and requires `206`, `video/*`, non-zero bytes, attachment disposition, exact
  CORS and private/no-store caching;
- reports only sanitized booleans, HTTP status, failure code and duration;
- notes only whether a Cloudflare request ID existed, never its value;
- deletes the sensitive input on success, failure, interruption or termination.

The operation runs only while all three Cobalt Provider gates are false. It neither recreates the
Worker nor changes rollout state.

## Tests and release boundary

Tests cover direct-source qualification, audited Tunnel qualification, missing client exits,
unverified browser/local-processing modes, descriptor host/query rejection, Range/MIME/attachment/
CORS/cache failures, 403 sanitization, release input ownership and isolated Compose execution.

After CI, the exact GitHub images may be deployed with Cobalt still closed. Production activation
requires a later explicit operation: rerun two TikTok samples, complete the standard handoff and
browser save, back up the key and release configuration, add only `tiktok:tunnel`, start Cobalt,
recreate the Worker, and enable one priority-450 secondary rollout. Existing TikTok Providers stay
ahead of Cobalt.
