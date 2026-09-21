# Work Item 84 — VidDown Vimeo handoff diagnostic closeout

## Scope

This item began from `main@d4e9be3`, where the VidDown Vimeo adapter and its
redirect-only policy were deployed but the three production gates and the
`viddown-net / vimeo / nl` rollout remained disabled.

The first implementation decision was deliberately evidence-led: browser
handoff could not be changed until the provider returned a reviewed media
candidate.

## Initial NL protocol result

The two owner-supplied public Vimeo samples were each sent once through the
anonymous page/token/API sequence from the NL worker environment. The initial
diagnostic recorded only status and shape metadata:

- page, token and loader requests returned HTTP 200;
- the loader response reported `state=1` and included an `error` field;
- zero MP4 candidates were present for either sample;
- no media Range request was made because there was no candidate to validate.

This was initially classified as a provider-side unavailable/no-media result.
A subsequent protocol comparison showed that it was a false negative caused by
VidDown changing its anonymous token flow: the page now embeds a dynamic token
and the page grew beyond the adapter's former 64 KiB bound. The result is
retained as historical evidence, not as a current availability conclusion.

## Implementation

- VidDown failure classification inspects bounded, typed error fields (`code`,
  `type`, `reason`, `status`, and `message`) without exposing raw values to
  public results or logs.
- Private, not-found and unsupported outcomes remain terminal; unknown upstream
  failures remain retryable/fallback-eligible according to the existing bounded
  router policy.
- No new Delivery policy, browser `cors-download` handoff, rollout rule, gate,
  sitemap entry, or production traffic was added by this diagnostic.

## Superseded decision

The original `deferred` decision was valid for the failed protocol run but is
superseded by Work Item 85. Production gates and rollout remain disabled until
the repaired adapter completes the separate browser handoff and release checks.

## Acceptance

- Provider tests cover error-field classification and preserve the no-media
  boundary.
- Work Item 85 records the protocol repair and the new two-sample recheck.
- Existing Delivery, retry, activation and production configuration remain
  unchanged.
- No raw source URL, response body, token, cookie or CDN URL is stored.
