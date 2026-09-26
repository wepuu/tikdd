# ADR-0048: GetXHamster progressive MP4 direct CDN delivery

## Decision

TikDD may use GetXHamster as an experimental xHamster Provider after a two-sample browser audit.
The adapter calls only the anonymous first-party `/api/video` endpoint and normalizes progressive
MP4 entries. Adaptive HLS entries and the Provider's `/f` relay are excluded from the public
result and from Delivery.

The versioned policy `getxhamster-xhamster-media-v1` accepts only HTTPS subdomains of
`xhcdn.com` and `ahcdn.com`, with public DNS, redirect validation, and one-time Delivery tickets.
The policy declares `cors-download`: the browser fetches the final CDN resource and saves a Blob;
TikDD never reads or relays media bytes. The public resolve result continues to contain no upstream
URL.

## Routing and limits

GetXHamster has xHamster priority 820 and is intended to precede the disabled 9xBuddy route and
the quota-limited LocoLoader fallback. It is disabled by default, allows one in-flight request,
spaces requests by two seconds by default, and disables queue replay. Configuration is bounded and
platform-scoped to xHamster.

## Consequences

- Progressive MP4 qualities are available without a server media proxy.
- HLS-only qualities are intentionally unavailable until a separately reviewed client stitching
  design exists.
- The current upstream response has no reviewed thumbnail; Web uses the platform fallback icon.
- `*.ahcdn.com` is a reviewed redirect boundary for this Provider only and must not be reused by
  another adapter without a separate audit.
