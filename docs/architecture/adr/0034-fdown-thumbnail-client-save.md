# ADR-0034: FDown thumbnails and browser-owned Facebook saves

## Status

Accepted for Work Item 69.

## Decision

FDown thumbnails are rendered directly by Web only when their URL is HTTPS,
credential-free, default-port, image-shaped, and on a reviewed `*.xx.fbcdn.net`
subdomain. Invalid or unavailable thumbnails fall back to the platform icon.

The `fdown-isuru-facebook-media-v2` Delivery policy advertises a
`cors-download` browser handoff. Web follows the one-use Delivery URL with a
credential-free CORS fetch, bounds the response to 200 MiB/120 seconds, and
saves a Blob with a TikDD filename. Other policies continue to use navigation.
Delivery remains a one-use audited 302 and never reads or streams media bytes.

## Compatibility and safety

`browserHandoff` is optional in the public Delivery response; missing values
mean `navigate` for rolling compatibility. A failed browser save never retries
the Provider; the fallback requests a fresh Delivery ticket and opens the
reviewed redirect. No CDN URL, cookie, response body, or upstream header is
exposed in the public result.
