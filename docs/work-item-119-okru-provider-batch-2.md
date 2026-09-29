# Work Item 119: second OK.ru Provider qualification batch

## Status

Implemented as an evidence-only closeout. No candidate reached the second-sample or portable
delivery gate.

## Scope

The batch evaluated OKVid, PasteDownload, SnapFrom, and the hosted AnyDownloader Web service from
NL. It reused the two native public samples and the portable-delivery boundary established by Work
Item 118 and ADR-0056. Sample addresses, response bodies, cookies, hidden-field values, tokens,
signed media addresses, query strings, and complete CDN hosts were not retained.

The checks were sequential, had no automatic retry, stayed within the forty-request batch budget,
limited document and script reads to 512 KiB, and stopped each candidate as soon as a mandatory
gate failed. No full media file was downloaded.

## Results

| Candidate | Reviewed protocol | Primary-sample result | Classification |
| --- | --- | --- | --- |
| OKVid | Anonymous same-origin `POST /` form | HTTP 200 HTML with no safe progressive MP4 | `no-media` |
| PasteDownload | Anonymous same-page GET form with page-issued hidden fields | HTTP 200 HTML with no safe progressive MP4 | `no-media` |
| SnapFrom | Page flow refers to session storage and a token but exposes no reproducible anonymous resolver endpoint | Active submission not attempted | `blocked` |
| AnyDownloader Web | Client lists WordPress API paths; the prerequisite token endpoint rejected the stateless NL request | Source submission not attempted | `blocked` |

Because no primary sample produced a safe MP4, the second native sample, media Range, cross-exit
replay, and browser attachment/CORS-save checks were correctly skipped. Landing-page support claims
were not treated as technical evidence.

## Repository changes

- Added four distinct candidate IDs to `provider:preflight`; the hosted
  `anydownloader-web-okru` ID remains separate from the existing self-hosted `anydownloader`
  candidate.
- Added only the two reproduced form endpoints to `ACTIVE_ENDPOINTS`. SnapFrom and AnyDownloader
  Web remain rejected by endpoint lookup.
- Extended the OK.ru evidence module with the six-state technical classification and the complete
  two-sample, Range, cross-exit, and browser-save qualification gate.
- Added all four candidates to the offline free-Provider portfolio and recorded only sanitized
  protocol facts.

## Decision

No candidate is qualified, so Work Item 120 is not opened. OK.ru remains `planned`; there is no
adapter, manifest capability, Delivery policy, activation gate, rollout rule, public route, SEO
page, sitemap entry, database change, Admin change, production configuration change, or deployment.

Future OK.ru testing should use a new candidate or a documented upstream protocol change and must
still satisfy ADR-0056 without TikDD media proxying or Provider-page handoff.
