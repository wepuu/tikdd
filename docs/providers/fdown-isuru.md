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
be absent. Only HTTPS MP4 URLs on the reviewed `fna.fbcdn.net` suffix become internal redirect
candidates. Provider URLs never cross the public resolve-result contract.

## Operational boundary

- Platform: Facebook public video/Reel URLs; private and restricted posts are terminal failures.
- Region: NL only.
- Timeout: 10 seconds; response limit: 512 KiB; redirect limit: zero.
- Request policy: one Provider request per task, no automatic retry, no Cookie, login, browser
  state, CAPTCHA or challenge bypass.
- Rate limits, challenges, authentication, private content, unavailable content, schema changes and
  missing MP4 resources map to typed Provider errors.
- Delivery remains one-use short-lived `302`; the Delivery service does not stream or proxy media.

## Qualification state

Two public Facebook samples resolved from NL and their media passed bounded public-DNS and Range
checks. The adapter and sanitized fixtures are now code-reviewed. Production enablement still
requires the owner’s terms and Delivery audit approvals, a backup, a GitHub-built image, and two
real browser downloads through the reviewed Delivery policy. Until then the Provider and its
rollout rule remain disabled.
