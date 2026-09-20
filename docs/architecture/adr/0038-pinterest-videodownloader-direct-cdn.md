# ADR-0038: Pinterest Video Downloader direct CDN delivery

## Status

Accepted for the Work Item 79 experimental Beta, with the provider and rollout gates defaulting
off until the production browser handoff is verified.

## Context

The Work Item 79 protocol batch tested free Pinterest and Vimeo candidates from the NL network
boundary. `pinterest-videodownloader.com/api/pin` returned public MP4 resources on the exact
`v1.pinimg.com` host for both reviewed Pin samples. The media endpoints responded to a 1 KiB
Range request with `206 video/mp4`. MediaFetcher and PinSaver returned no media for the same
Pinterest samples; HHHDownload required its own `/api/stream` media relay and is not accepted.

The Vimeo candidates either returned no media, a 400 response, a missing endpoint, a login
boundary, or a challenge. No Vimeo adapter is introduced by this decision.

## Decision

- Add one `pinterest-videodownloader` adapter for Pinterest only.
- Resolve short `pin.it` links through the provider's anonymous `/api/expand`, then read `/api/pin`.
- Accept only HTTPS MP4 URLs on the exact reviewed `v1.pinimg.com` host. The Provider API host is
  not a Delivery target.
- Register `pinterest-videodownloader-pinterest-media-v1` as a redirect-only Delivery policy.
- Keep Provider URLs out of the public result; they remain encrypted Delivery candidates.
- Keep the adapter, three gates, and rollout rule disabled until a production browser handoff is
  verified. No proxy, Provider-page handoff, database migration, sitemap, or public contract
  change is allowed.

## Consequences

Pinterest can be promoted to a single-platform Beta without changing existing X, Instagram,
TikTok, Facebook, Admin, or calibration state. Vimeo remains deferred and must not be advertised
or routed until a new bounded protocol batch produces repeatable direct media evidence.
