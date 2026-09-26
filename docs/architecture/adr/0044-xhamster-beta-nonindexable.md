# ADR-0044: xHamster Beta page remains non-indexable

> Superseded by ADR-0049 after GetXHamster production delivery and owner browser validation made
> xHamster eligible for the shared route-qualified search boundary. The homepage exclusion remains.

## Decision

TikDD may expose a directly reachable `/xhamster-downloader` page for honest Beta guidance,
but the page is `noindex`, is excluded from the sitemap, and does not receive hreflang or
structured-data index eligibility. The stable-only SEO gate remains unchanged: only the homepage
and stable platform pages can enter public index surfaces.

The homepage, FAQ, and help copy do not promote xHamster. The xHamster route is backed by the
explicit `xhamster.com` catalog rule and the disabled-by-default LocoLoader adapter. Production
traffic requires the existing provider terms, delivery audit, rollout, and host-policy controls;
this ADR does not enable any of them.

## Consequences

- Direct visitors can see the platform boundaries without creating an SEO exception.
- Search engines are not asked to index an experimental adult-content page.
- LocoLoader's dynamic form key and `*.xhcdn.com` redirect boundary remain internal to the
  resolver and Delivery services; public results never contain upstream URLs.
- The free upstream quota and one-attempt policy are represented as operational limitations.
