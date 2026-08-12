# @tikdd/admin-contracts

Internal runtime-validated contracts for the private TikDD owner control plane defined by
[ADR-0010](../../docs/architecture/adr/0010-owner-control-plane-routing-and-publication.md).

This package is intentionally separate from `@tikdd/contracts`: none of its operational,
configuration, revision, or publication fields belong in the public resolve/result API.

## Boundaries

- Read models contain sanitized aggregates and explicit freshness states only.
- Route policies order or narrow manifest-eligible Providers; validation cannot grant capability.
- Platform presentation controls may change public labels, visibility, and page association only;
  catalog hosts, extractor keys, Provider capabilities, and delivery behavior remain code-owned.
- Locale tags are canonical BCP 47 values rather than a closed enum.
- Content uses fixed template schemas and safe Markdown; raw HTML and arbitrary structured data are
  rejected.
- SEO accepts locale-relative paths and approved asset references, never arbitrary canonical URLs,
  robots XML, or JSON-LD.
- Published snapshots contain public content only. Owner subjects, reasons, commands, and drafts are
  excluded.
- `assertAdminSafeValue` is a defense-in-depth check for API responses, fixtures, logs, and tests.

Provider manifests, platform host rules, adapters, delivery allowlists, upstream headers, and
secrets remain code-owned outside this package.
