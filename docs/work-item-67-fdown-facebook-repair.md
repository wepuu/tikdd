# Work Item 67 — FDown Isuru Facebook 下载修复

Status: implementation in progress; production rollout remains disabled until release verification.

## Root cause

The NL probe returned a successful JSON payload with a top-level media URL and additional format
URLs. The real resources were HTTPS MP4 files on ordinary `*.fbcdn.net` subdomains outside the
`fna` family. The previous adapter accepted only `*.fna.fbcdn.net`, so every candidate became
`invalid_result` and Delivery was never reached. Facebook jobs also allowed queue-level replay,
which multiplied one user submission into three identical upstream requests.

## Scope of the repair

- Add versioned Delivery policy v2 for real `*.fbcdn.net` subdomains while retaining v1 for legacy
  tickets. HTTPS, public DNS, redirect and one-use ticket checks are unchanged.
- Tolerate the observed top-level URL and format list, deduplicate resources, and allow optional
  metadata to be absent. Provider URLs remain internal-only.
- Execute one FDown request per Facebook task and disable queue-level automatic replay for this
  Provider. Sequential fallback inside a future Facebook routing plan remains available.
- Emit only metadata-only internal diagnostics: status, content-type category, phase, candidate and
  rejection counts, typed failure code and duration. No source URL, response body, credentials,
  headers, query parameters or complete media URL is recorded.

## Verification and release gate

Sanitized fixtures cover non-`fna` `fbcdn.net` resources, duplicate candidates and missing optional
metadata. Delivery tests cover the v1/v2 hostname boundary; retry tests ensure one FDown attempt;
diagnostic tests assert that serialized events contain no media host or URL. Run targeted tests,
`pnpm check`, `git diff --check` and production Compose validation before creating the PR.

After a GitHub-built image is deployed with FDown still disabled, back up production state, verify
core health, then enable the existing rule with a CAS update and enable the three FDown gates. Run
each of the two existing public Facebook samples once through the browser and verify the audited
302 and final public CDN response. If either fails, disable the rollout first and then the gates.
FDown remains experimental/Beta and is not added to the sitemap.
