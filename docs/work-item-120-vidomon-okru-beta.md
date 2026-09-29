# Work Item 120: Vidomon OK.ru main Provider evaluation

## Status

Technical implementation completed through parsing; Beta launch blocked by portable delivery.

## Implemented evidence

- Added a runtime-validated, default-off `vidomon` manifest for `odnoklassniki` with no production
  delivery mode.
- Reproduced the observed landing-token and request-hash protocol with bounded page and API reads.
- Added a tolerant parser for progressive MP4 metadata, optional title/thumbnail/duration fields,
  true `*.okcdn.ru` subdomains, duplicate removal, and sanitized diagnostics.
- Added explicit Provider Lab endpoint mapping, synthetic success/failure coverage, one-execution
  OK.ru retry policy, and a technical host-policy test.
- Kept upstream addresses, source samples, tokens, Cookies, response bodies, and signed query
  strings out of repository fixtures and logs.

## Live delivery result

Two native public samples each returned HTTP 200 JSON and six candidate MP4 entries. For each
sample, the first two preferred direct CDN entries returned HTTP 400 under both Range and ordinary
GET checks. The Provider's fixed download endpoint returned HTML without the Provider Cookie, even
when supplied the anonymous PHP session identifier through the public `sid` parameter.

This explains why manual use on the Vidomon page succeeds while a TikDD 302 cannot: the Provider
page owns browser session state that TikDD users do not possess. The result is `delivery-blocked`,
not a parser failure.

## Production decision

- No Worker registration, activation gates, rollout rule, production configuration, deployment,
  public page, SEO content, or sitemap entry is added.
- No Provider-page relay, Cookie replay, browser automation, or TikDD media proxy is introduced.
- OK.ru remains `planned`.

Vidomon may be reconsidered only when an upstream change yields a cookie-free browser GET or a
portable direct media resource for two distinct samples. See ADR-0056 and ADR-0057.
