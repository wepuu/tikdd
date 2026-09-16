# FDown Isuru Facebook Provider

Status: implemented and disabled pending production Delivery approval

## Reviewed protocol

The NL technical batch observed an anonymous JSON request:

```text
POST https://fdown.isuru.eu.org/download
Content-Type: application/json
{"url":"<canonical Facebook URL>","quality":"best"}
```

The adapter accepts the observed `status`, `video_info`, top-level `download_url` and
`available_formats` fields. Optional title, uploader, thumbnail, duration and quality values may
be absent. A thumbnail is rendered only from a reviewed HTTPS image URL on a real
`*.xx.fbcdn.net` subdomain. HTTPS MP4 URLs on a real `*.fbcdn.net` subdomain become internal redirect candidates;
the bare suffix, look-alike domains, credentials, custom ports and non-HTTPS URLs are rejected.
Provider URLs never cross the public resolve-result contract. Delivery policy v2 is used for new
results, while v1 remains registered for still-valid legacy tickets.

## Operational boundary

- Platform: Facebook public video/Reel URLs; private and restricted posts are terminal failures.
- Region: NL only.
- Timeout: 10 seconds; response limit: 512 KiB; redirect limit: zero.
- Request policy: one Provider request per task, no automatic retry or queue replay, no Cookie, login, browser
  state, CAPTCHA or challenge bypass.
- Rate limits, challenges, authentication, private content, unavailable content, schema changes and
  missing MP4 resources map to typed Provider errors.
- Delivery remains one-use short-lived `302`; the Delivery service does not stream or proxy media.
  New v2 tickets advertise `cors-download`, allowing the browser to fetch and save the MP4 Blob
  directly from Meta CDN; older v1 tickets and all other Providers use navigation.

## Qualification state

Two public Facebook samples resolved from NL and their media passed bounded public-DNS and Range
checks. The adapter and sanitized fixtures are now code-reviewed. Production enablement still
requires the owner's terms and Delivery audit approvals, a backup, a GitHub-built image, and two
real browser downloads through the reviewed Delivery policy. Until then the Provider and its
rollout rule remain disabled.
