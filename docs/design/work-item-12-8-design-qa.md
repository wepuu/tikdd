# Work item 12.8 design QA — Search index passport

Reviewed against the running implementation on 2026-08-12 using the `frontend-design` discipline.

The SEO surface extends the publication proofing desk rather than becoming a separate analytics
dashboard. Its signature element is a passport stamp that expresses one binary technical result:
eligible or blocked. The left rail contains only derived facts; editorial fields and previews occupy
the two-column workbench.

- Desktop: canonical/hreflang/sitemap status stays visible beside Search and Social previews.
- Mobile 390 × 844: passport, fields, and previews collapse in reading order with no horizontal
  document overflow.
- Blue is reserved for editable/preview state, mint for eligible, amber for blockers, and violet for
  locale relationships.
- Eligibility is always textual and icon-supported; color is never the sole signal.
- Empty states say why no passport exists and do not imply that zero blockers means indexable.

The Product Design work item deliberately does not add traffic charts, keyword recommendations, or
freely editable robots/JSON-LD controls. Those would obscure the single owner decision: whether the
localized page is technically safe and ready to publish.
