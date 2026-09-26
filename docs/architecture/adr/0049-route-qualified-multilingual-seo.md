# ADR-0049: Route-qualified multilingual search publication

## Status

Accepted for Work Item 108.

## Context

TikDD previously treated the catalog `stable` label as a prerequisite for search indexing. That
kept working Beta downloaders out of search even after their Provider, Delivery policy, rollout,
and browser flow were proven in production. It also limited the public content snapshot to English
and Simplified Chinese.

Google recommends a distinct URL for each language, self-canonical pages, reciprocal `hreflang`
links, and fully qualified canonical URLs in XML sitemaps. Search publication must still avoid
thin, automatically scaled doorway pages and must never expose task, result, ticket, Admin, API, or
Delivery internals.

## Decision

1. Search eligibility is separate from the product maturity label. A `stable` or `experimental`
   platform may be indexed only when it has a manifest-enabled, production-eligible route with a
   non-zero allocation, an acceptable runtime state, complete localized content, and reviewed GEO
   content. `planned` and `paused` platforms remain ineligible.
2. Beta pages keep a visible `Beta` label. Indexing does not silently promote a platform to stable.
3. The reviewed content pack contains `en`, `zh-CN`, `es`, `fr`, `de`, `it`, `tr`, `pl`, and `ja`.
   Every locale has its own visible copy and metadata; the locale URLs are not language redirects.
4. The sitemap contains only self-canonical homepage and route-qualified platform pages. Each entry
   uses the public HTTPS origin, the immutable snapshot timestamp, reciprocal language alternates,
   and an English `x-default`. Unsupported `priority` and `changefreq` hints are omitted.
5. xHamster remains absent from homepage promotion. Its dedicated localized downloader page may be
   indexed when the same route, delivery, content, and publication gates pass.
6. The primary form label is localized from the user intent “Download”. Internal API names and the
   asynchronous resolve task model do not change.
7. The former one-time starter bootstrap becomes an explicit versioned content-pack action. It may
   add missing locales and write reviewed content as ready drafts after a snapshot already exists.
   Applying the pack never publishes automatically and preserves site integration identifiers.
8. No `VideoObject` markup is emitted because downloader pages are not video watch pages. Existing
   code-owned `SoftwareApplication`, `FAQPage`, `HowTo`, and breadcrumb data remain tied to visible,
   eligible page content.

This decision supersedes only the stable-only search boundary in ADR-0010, ADR-0025, and ADR-0044.
Their immutable publication, code-owned structured-data, private-route, and delivery boundaries
remain in force.

## Consequences

- A Provider outage or disabled rollout blocks a new publication from claiming that platform is
  search eligible; it does not rewrite an already immutable snapshot behind the owner's back.
- Publishing nine complete locales is a deliberate Admin operation and can be rolled back through
  the existing snapshot mechanism.
- Task/result pages stay `noindex` and out of the sitemap. Provider URLs and credentials remain
  private to the resolver and Delivery services.

