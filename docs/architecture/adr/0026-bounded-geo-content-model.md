# ADR-0026: Bounded GEO content from reviewed platform pages

- Status: Accepted
- Date: 2026-09-08
- Scope: Work Item 25A
- Extends: ADR-0010, ADR-0013, and ADR-0025

## Context

TikDD has fixed platform-page templates and a code-owned structured-data renderer. The pages need
concise answer-oriented copy for human readers and future search assistants, but a generic SEO or
citation editor could publish unsupported availability claims, hidden fallback translations, or
arbitrary remote entities.

## Decision

- Platform page content may carry one optional `geo` object in the existing JSONB content field.
  Older snapshots without the object remain valid and parse as `null`.
- The object contains a short plain-text `directAnswer`, a `reviewStatus`, an optional review
  timestamp, and a bounded list of code-owned `sourceRefs`.
- Admin may select source IDs from the reviewed source catalog. It cannot submit citation URLs,
  HTML, scripts, remote entities, or raw JSON-LD. Web owns the fixed display labels and links for
  those IDs.
- An indexable platform page must have reviewed GEO content, a review timestamp, and at least one
  source reference. Experimental or noindex pages may remain without GEO content for editorial
  review and never emit public structured data.
- GEO fields are rendered as visible page content. Structured data may only derive from content
  that is visible on the same eligible page, preserving ADR-0025.
- This increment changes no Provider, rollout, Admin authentication, calibration, or production
  traffic behavior and requires no database migration.

## Consequences

The existing content publication and rollback flow remains authoritative. A missing or unreviewed
GEO block blocks only an attempt to index a platform page; it does not block a noindex Beta page or
the resolver. The source catalog is deliberately small and code-reviewed, so adding a source or a
new GEO field requires a follow-up code review and, when the publication boundary changes, another
ADR.

## Verification

Contract tests cover legacy snapshots, unsafe answers, duplicate/unknown sources, and the
indexability blocker. Admin tests cover source selection serialization. Web tests cover visible
answer rendering inputs, source allowlisting, and continued JSON-LD suppression for noindex pages.
