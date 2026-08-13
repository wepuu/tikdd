# ADR-0013: Bounded owner settings and known-snapshot recovery

- Status: Accepted
- Date: 2026-08-13
- Scope: work item 12.10
- Extends: ADR-0010 and ADR-0011

## Context

The single TikDD owner needs daily site identity, locale publication defaults, deployment readiness,
and recovery controls. A generic settings database, secret editor, cache purge, log viewer, SQL
console, or shell would broaden the Admin boundary beyond the personal-site use case and could
expose the public resolve or delivery plane.

## Decision

Site identity and default social metadata are added to the existing versioned, per-Locale shared
content object. Locale direction, fallback, enabled state, and default status remain in the existing
Locale revision chain. They are drafts until the established complete-snapshot publication flow
promotes them. Existing snapshot parsing supplies safe defaults for fields absent from older
snapshots, so no persistence migration or mixed public state is introduced.

Infrastructure settings are a sanitized read projection: deployment, region, password owner access,
Cloudflare/Nginx deployment markers, dependency freshness, scheduler state, and snapshot readiness.
Secret configuration is projected only as `configured` or `missing`; values, fingerprints, lengths,
and sources are forbidden Admin fields.

Recovery is limited to exact durable state:

- retry the latest failed publication acknowledgement;
- rebuild a new immutable revision from the current propagated active snapshot;
- revalidate only the active snapshot's persisted, validated affected paths;
- roll back through the existing known propagated revision command.

Every new recovery command carries the deployment, expected latest revision, exact snapshot ID,
bounded reason, deployment confirmation, CSRF token, owner session, and idempotency key. PostgreSQL
locks the deployment and verifies the named active snapshot before any effect. Replayed idempotency
keys return their prior receipt without issuing another Web acknowledgement. Rebuild creates a new
revision; cache invalidation never accepts paths, tags, patterns, URLs, or a global scope from the
browser.

## Consequences

- Public Web continues to read only one immutable snapshot and does not depend on Admin API.
- No new table or public OpenAPI field is required.
- Older snapshots remain readable with `TikDD` and null social defaults.
- A missing Web revalidation secret disables effective recovery and is shown only as missing.
- Admin still provides no raw logs, URL/task lookup, secret editing, Provider adapter editing,
  arbitrary cache purge, SQL, or shell access.
