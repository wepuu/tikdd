# Work Item 102 — Public Origin binding repair

## Status

Implemented on `codex/wi102-public-origin-binding`; production deployment is a separate release
step. Provider gates and rollout rules are unchanged by this work item.

## Root cause

The production environment used `WEB_ORIGIN=http://web:3000`. API and Delivery passed that value to
Fastify CORS, so a browser request from `https://www.tikdd.cc` received the wrong
`Access-Control-Allow-Origin`. The browser rejected the preflight before `POST /v1/resolve-tasks`,
which explains the absence of new tasks and Provider attempts across xHamster, TikTok, and
Instagram. The queue was not backed up.

`WEB_ORIGIN` was also used by Admin for private Web content revalidation, so the deployment
configuration overloaded one variable with two different origins.

## Implementation

- API and Delivery now prefer `TIKDD_WEB_PUBLIC_ORIGIN` for CORS.
- Production requires that public value and rejects non-HTTPS or non-exact origins.
- Admin supports `ADMIN_CONTENT_WEB_ORIGIN` for its private Web revalidation target.
- The production release script validates the public origin before Compose configuration.
- Added contract, Admin configuration, and release-script regression tests.
- Added [ADR-0047](architecture/adr/0047-public-web-origin-binding.md).

## Release verification

After CI and exact-SHA image verification, deploy API and Delivery with the existing Provider
configuration unchanged. Verify OPTIONS from `https://www.tikdd.cc` returns the exact public Origin,
then submit one existing Instagram, TikTok, and xHamster canary. Each must create a new task before
Provider-specific results are interpreted. Keep LocoLoader disabled until the 9xBuddy primary route
has a new, attributable production result.

No migration, Provider adapter, public contract, media proxy, or calibration activity is introduced.
