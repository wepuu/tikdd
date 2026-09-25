# LocoLoader / xHamster and Lab platform capabilities

LocoLoader is an experimental, disabled-by-default site adapter for public xHamster pages. Its
manifest also exposes X, TikTok, and Facebook as Lab capabilities so protocol evidence can be
collected without granting them Delivery. The adapter uses the public landing page to obtain a
short-lived cookie and submits the canonical URL plus a time-dependent form key to the site's
anonymous extraction endpoint. It does not use user cookies, login state, CAPTCHA tokens, or
Provider-page handoff.

Only HTTPS progressive MP4 links on reviewed `*.xhcdn.com` subdomains are normalized. The Delivery
service keeps those URLs encrypted and issues the normal one-time redirect ticket; the public
resolve result never exposes an upstream URL. The upstream free tier can be quota-limited, so
automatic queue replay is disabled.

The Worker applies one shared Redis extraction budget to the NL fleet. The default is two
extraction POSTs per six-hour window, one in-flight request, and a one-second spacing interval.
The budget is global across platforms and is consumed when an extraction POST is admitted; it is
not a per-user allowance and is never bypassed by rotating cookies or IPs. Queue replay is disabled.

Only xHamster is currently approved and Delivery-verified. A later platform qualification must
provide real response fixtures, CDN host rules, the normal rollout rule, gate triplet, browser
download verification, and a short observation window before it can be enabled.
