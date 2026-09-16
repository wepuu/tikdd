# ADR-0033: Versioned Facebook fbcdn Delivery policy

Status: Accepted — 2026-09-16

## Context

Work Item 65/66 validated that FDown Isuru returns public Facebook media on ordinary
`*.fbcdn.net` subdomains as well as the narrower `*.fna.fbcdn.net` family. The first browser
attempt was rejected before Delivery because the adapter only accepted the narrower suffix. The
Delivery boundary must be widened without accepting suffix look-alikes or turning Delivery into a
general-purpose proxy.

## Decision

- Keep the existing v1 policy, which accepts only `*.fna.fbcdn.net`, so unexpired legacy tickets
  remain verifiable.
- Register `fdown-isuru-facebook-media-v2` for new FDown results. It accepts only a non-empty,
  real subdomain of `fbcdn.net` and continues to require HTTPS, public-DNS host validation, the
  existing redirect limit and a one-use short-lived ticket.
- Reject the bare `fbcdn.net` hostname, look-alike/suffix domains, credentials, custom ports and
  non-HTTPS URLs. Provider input cannot select or extend a policy.
- The resolver still returns internal candidates only; public resolve results never contain media
  URLs and Delivery continues to issue an audited redirect rather than stream bytes.

## Consequences

FDown can deliver the hosts observed in the real protocol probe while preserving the prior ticket
and SSRF boundary. Legacy v1 tickets remain compatible until expiry. Any future Facebook Provider
must receive an explicitly reviewed policy instead of reusing this broad suffix implicitly.
