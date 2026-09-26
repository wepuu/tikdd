# ADR-0047: Separate browser CORS and Admin Web origins

## Context

API and Delivery CORS must allow the canonical public Web origin. Admin content publication also
needs an origin from which the Admin API can call Web's internal revalidation endpoint. Reusing one
`WEB_ORIGIN` value for both roles allowed an internal Docker address (`http://web:3000`) to be sent
as the browser CORS origin, causing browsers to reject every resolve-task submission before the API
created a task.

## Decision

- API and Delivery load `TIKDD_WEB_PUBLIC_ORIGIN` for browser CORS and require an exact HTTPS origin
  in production.
- `WEB_ORIGIN` remains a local-development compatibility fallback for API and Delivery, but it is
  not used when the explicit public value is present.
- Admin content revalidation loads `ADMIN_CONTENT_WEB_ORIGIN` when configured and otherwise keeps
  the existing `WEB_ORIGIN`/public-origin fallback for rolling compatibility. The internal Web
  service address is therefore never used as a browser CORS value.
- Release validation checks the public origin before Compose configuration is accepted.

No public API, database schema, Provider route, Delivery media mode, or Admin lifecycle changes.

## Consequences

The public Web origin is explicit and fail-closed in production. A release can keep Admin-to-Web
traffic on the private Compose network without breaking browser submissions. Existing development
stacks continue to work with `WEB_ORIGIN=http://localhost:3000`.
