# Work Item 84 — VidDown Vimeo handoff diagnostic closeout

## Scope

This item began from `main@d4e9be3`, where the VidDown Vimeo adapter and its
redirect-only policy were deployed but the three production gates and the
`viddown-net / vimeo / nl` rollout remained disabled.

The first implementation decision is deliberately evidence-led: browser handoff
cannot be changed until the provider returns a reviewed media candidate.

## NL protocol result

The two owner-supplied public Vimeo samples were each sent once through the
anonymous page/token/API sequence from the NL worker environment. The diagnostic
recorded only status and shape metadata:

- page, token and loader requests returned HTTP 200;
- the loader response reported `state=1` and included an `error` field;
- zero MP4 candidates were present for either sample;
- no media Range request was made because there was no candidate to validate.

This is a provider-side unavailable/no-media result for this run. It is not
evidence that Vimeo media delivery or CORS is safe to activate.

## Implementation

- VidDown failure classification now also inspects bounded, typed error fields
  (`code`, `type`, `reason`, `status`, and `message`) without exposing their raw
  values to public results or logs.
- Private, not-found and unsupported outcomes remain terminal; unknown upstream
  failures remain retryable/fallback-eligible according to the existing bounded
  router policy.
- No new Delivery policy, browser `cors-download` handoff, rollout rule, gate,
  sitemap entry, or production traffic was added.

## Decision

VidDown Vimeo remains `deferred`. The existing `viddown-net-vimeo-media-v1`
policy remains redirect-only and default-off. The next Vimeo attempt requires a
new bounded provider recheck that produces at least one reviewed MP4 candidate;
only then may a separate browser handoff decision be made.

## Acceptance

- Provider tests cover error-field classification and preserve the no-media
  boundary.
- Existing Delivery, retry, activation and production configuration remain
  unchanged.
- No raw source URL, response body, token, cookie or CDN URL is stored.
