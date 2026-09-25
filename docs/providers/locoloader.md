# LocoLoader / xHamster

LocoLoader is an experimental, disabled-by-default site adapter for public xHamster pages. It
uses the public landing page to obtain a short-lived cookie and submits the canonical URL plus a
time-dependent form key to the site's anonymous extraction endpoint. The adapter makes one bounded
request sequence and does not use user cookies, login state, CAPTCHA tokens, or Provider-page
handoff.

Only HTTPS progressive MP4 links on reviewed `*.xhcdn.com` subdomains are normalized. The Delivery
service keeps those URLs encrypted and issues the normal one-time redirect ticket; the public
resolve result never exposes an upstream URL. The upstream free tier can be quota-limited, so
automatic queue replay is disabled.

The provider is not enabled in production by this work item. A later qualification must include
the normal rollout rule, gate triplet, browser download verification, and short observation window.
