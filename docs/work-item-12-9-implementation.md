# Work item 12.9 — Public Web published-content integration

Status: complete on 2026-08-12.

## Delivered

- Public Web now reads one runtime-validated immutable snapshot through a dedicated read boundary;
  it does not call Admin API and never queries locale, page, shared-content, or draft heads.
- The loader keeps a process-local last known-good snapshot and a bundled reviewed English and
  Simplified Chinese seed for cold-start database outages. Production can require a separate
  `PUBLIC_CONTENT_DATABASE_URL` read identity.
- Locale registration, locale switches, localized route matching, safe local redirects, 404s,
  homepage/platform/guide/FAQ/legal templates, metadata, canonical/hreflang, sitemap, and robots
  derive from the same complete snapshot.
- Admin API now sends a bounded, HMAC-authenticated snapshot-ID/path command to Web. Web validates
  the candidate from the publication table, preflights its default homepage and exact route set,
  and acknowledges the matching snapshot without making it public. The durable active head moves
  only after that positive acknowledgement.
- A metadata-only internal health response reports snapshot revision, source, and freshness. It
  exposes no draft, owner, source URL, task, media, Provider, credential, or raw payload fields.

## Failure model

Database or Admin/editorial outages do not empty the site. Public requests continue from the last
known-good snapshot, and a fresh process uses the bundled seed. Revalidation is fail-closed when
the shared secret, Web origin, candidate, route scope, acknowledgement, or timeout is invalid. A
failed acknowledgement leaves the prior active snapshot unchanged and records propagation failure.

Dynamic task, result, delivery, API, Admin, internal, candidate, ticket, and object paths remain
disallowed by robots and absent from the sitemap.

## Verification

- `pnpm test:work-item-12-9` covers snapshot validation, known-good/seed fallback, candidate
  preflight without activation, signed acknowledgement, replay/tamper rejection, and existing
  bilingual task/result regressions.
- Type checks and production builds cover Admin contracts, Admin API, and Web.
- No live Provider request or media delivery is performed by the gate.
