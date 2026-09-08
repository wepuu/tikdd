# Work Item 25B — Instagram GEO editorial seed and publication

## Scope

This increment applies the bounded GEO contract from ADR-0026 to the existing bilingual Instagram
Beta page. It is content wiring, not a new SEO or Provider system.

- Reuse the existing `PlatformPageContentSchema.geo` object.
- Reuse `limitationsMarkdown` for public limitations; do not create a duplicate field.
- Use only the code-owned `tikdd-workflow` and `instagram-public-content` source IDs.
- Keep the bundled content `draft` until an owner has performed and recorded the review.
- Keep both locales `noindex` and out of sitemap/hreflang/structured-data eligibility.

No database migration, Provider change, rollout change, calibration action, or permanent Admin
startup is part of this work item.

## Verification

- The bilingual seed parses through `PublishedContentSnapshotSchema`.
- GEO answers are bounded plain text without remote URLs or raw HTML.
- Sources are fixed and HTTPS-only.
- Instagram pages remain `noindex` and absent from the sitemap.
- Existing X/Instagram resolver and delivery tests remain unchanged.

Production content publication, when desired, uses the existing loopback-only Admin workflow as a
separate operator action: start Admin on demand, preview and publish the snapshot, verify the
public pages, then stop Admin.
