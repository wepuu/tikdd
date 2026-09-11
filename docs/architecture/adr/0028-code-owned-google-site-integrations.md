# ADR-0028: Code-owned Google site integrations

Status: Accepted — 2026-09-10

## Context

The owner needs to configure Google Analytics and Google AdSense from the Admin settings. The
existing content publication pipeline is the authority for public Web configuration, but it must
not become an arbitrary HTML or JavaScript injection surface.

## Decision

- Admin accepts only a Google Analytics measurement ID (`G-...`) and a Google AdSense publisher ID
  (`ca-pub-...`). Empty values disable the corresponding integration.
- The values are stored with the default locale's shared-content revision, then copied into the
  validated published snapshot as a site-level `siteIntegrations` object. Existing snapshots and
  content rows remain readable because both fields default to disabled.
- Web renders fixed, code-owned Google tags from the published snapshot. It never renders raw
  snippets supplied by Admin.
- Saving remains a content-draft operation; the tags take effect only after an authenticated
  publication of a complete snapshot. `readonly` cannot save them and `full` remains required for
  publication or recovery.
- The integration identifiers are not credentials. They may be returned in the authenticated
  Admin settings view, while cookies, tokens, upstream URLs, and arbitrary script text remain
  forbidden.

## Consequences

This requires no SQL migration or new public endpoint and keeps locale-independent tags consistent
across all localized pages. A future integration must add a bounded identifier schema and a
code-owned renderer; raw third-party HTML is out of scope.
