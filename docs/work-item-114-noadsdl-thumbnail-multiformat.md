# Work Item 114: NoAdsDL thumbnail and multi-format optimization

## Outcome

NoAdsDL now preserves a narrowly validated YouTube thumbnail and can prepare up to two combined MP4
formats. Format offers are normalized, de-duplicated and ordered with 720p first. Only successfully
prepared files become public format metadata and encrypted Delivery candidates.

## Bounded execution

The adapter performs one metadata request and at most two sequential generation jobs. Both jobs
share the existing 40-second budget and twenty status polls. The first job remains mandatory; an
optional second job failure is recorded as a sanitized diagnostic and the primary result is kept.
`NOADSDL_MAX_PREPARED_FORMATS` defaults to two and is constrained to one or two.

Thumbnail URLs are accepted only from exact reviewed YouTube image hosts over HTTPS with a default
port and a JPG, JPEG, PNG or WebP path. Missing or rejected thumbnails do not fail media resolution.

## Boundaries

This item does not add audio/video merging, transcoding, Provider-page handoff, server media proxying,
source-CDN allowlists, database migrations or public API changes. The existing
`noadsdl-youtube-media-v1` Delivery policy remains the only media boundary.

## Verification

Tests cover legacy and sparse format schemas, preferred ordering, format-ID de-duplication, the
two-job limit, secondary partial success, thumbnail spoofing, diagnostic redaction and runtime
configuration bounds. Release verification must still use exact-SHA images and a real browser;
deployment and rollout changes require separate authorization.
