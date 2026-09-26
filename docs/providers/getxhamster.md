# GetXHamster / xHamster Provider

GetXHamster is an experimental, disabled-by-default adapter for public xHamster video pages.
Its anonymous first-party endpoint is `GET /api/video?u=<canonical-url>`. TikDD does not send user
cookies, login state, browser tokens, or CAPTCHA state.

The adapter accepts only the progressive MP4 entries in the response `media` array. Adaptive
`streams` entries and the Provider's `/f` proxy are deliberately ignored. Optional title, duration,
size, and filename fields do not affect a valid MP4 result; the current endpoint does not expose a
reviewed thumbnail, so the Web fallback icon is expected.

Only HTTPS subdomains of `xhcdn.com` and `ahcdn.com` are eligible for the versioned Delivery policy
`getxhamster-xhamster-media-v1`. The browser uses the existing `cors-download` handoff so the
client connects directly to the CDN; the API, Worker, and Delivery service never relay media bytes.

The default protection is one in-flight request and a two-second spacing interval. Queue replay is
disabled. `GETXHAMSTER_AUTOMATION_USE_APPROVED` and `GETXHAMSTER_DELIVERY_AUDIT_APPROVED` are
required alongside the provider flag, and approved/Delivery-verified platform lists are restricted
to `xhamster`.

GetXHamster is the planned xHamster primary route. 9xBuddy remains disabled after its conversion
timeouts, while LocoLoader remains the bounded, quota-limited sequential fallback. The route is
not stable SEO support until two distinct public samples and browser Delivery verification pass.
