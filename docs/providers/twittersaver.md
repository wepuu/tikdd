# TwitterSaver provider record

- Provider ID: `twittersaver`
- Site: <https://twittersaver.net/>
- Kind: third-party site adapter
- Declared platform: `x`
- Default state: disabled
- Technical review: 2026-08-04
- Test authorization: project owner asserted on 2026-08-04
- Current production scope: excluded from the ADR-0017 SSSTwitter-only internal preflight and first
  X evidence gate; the Provider remains disabled
- Reviewed routing regions: `nl` (production), `global` (local/historical), `canary-global`
  (isolated technical Canary)
- X routing priority: 900 (primary)

## Public workflow observed

The English landing page submits X/Twitter URLs to `POST /api/ajaxSearch` as URL-encoded fields
`q`, `lang`, and `cftoken`. A successful JSON response embeds result HTML with a title, duration,
thumbnail, and MP4 links. The adapter parses only MP4 download controls, creates TikDD format IDs,
and maps each one to a server-only redirect candidate. Candidate URLs are encrypted before the
worker transaction commits; the public task result contains only TikDD format IDs and metadata.

The reviewed redirect policy is `twittersaver-media-v1`. It permits only the exact HTTPS hostname
`dl.snapcdn.app`, never a subdomain wildcard. Candidate lifetime is capped at ten minutes. Redirect
delivery rejects server-held cookies or headers, validates every DNS answer as public, and consumes
the opaque ticket before returning a single 302 response.

If the landing page contains Cloudflare Turnstile, the adapter returns `provider_challenge` and
allows routing fallback. It does not call challenge-solving services or the site's local verification
fallback. HTTP 429, upstream outage, malformed JSON, provider misses, and changed markup map to the
shared TikDD error taxonomy.

Private, deleted, unavailable, and geographic-policy outcomes are terminal and do not allow the
secondary provider to retry the same content. Only typed transient or unsupported-variant outcomes
may enter sequential fallback.

## Terms gate

The public Terms of Service currently describe the use license as personal, non-commercial,
transitory viewing and prohibit commercial use of site materials. That is incompatible with assuming
permission for a production or commercial server integration. `ENABLE_TWITTERSAVER_PROVIDER=true`
therefore also requires the separately audited `TWITTERSAVER_TERMS_APPROVED=true` flag.

The project owner has asserted technical-test authorization and historically reviewed the Provider
for `nl`; external legal evidence is not stored in this repository. ADR-0017 excludes TwitterSaver
from the current checked-in internal preflight and first X production evidence gate. The adapter
remains disabled by default. Any future production qualification requires a new exact-scope
decision plus every independent runtime, rollout, health, Delivery, and evidence gate.

## Test and operations notes

- Fixtures contain authorized synthetic metadata and non-fetched fixture paths on the reviewed media
  hostname. Tests never request fixture media.
- The 2026-08-04 authorized X canary succeeded and produced four normalized MP4 formats. The runner
  did not persist the response or media links.
- A host-only audit found `dl.snapcdn.app` for all four candidates. A bounded HEAD audit returned
  HTTP 200 and `video/mp4` without an intermediate redirect; paths, queries, titles, and payloads
  were not recorded.
- The local end-to-end pilot created four encrypted candidates, issued one opaque ticket, returned a
  non-followed 302 to the reviewed host, and returned 410 when the ticket was replayed.
- The authorized canary and its data-handling boundary are recorded in
  [canary-authorization.md](canary-authorization.md).
- Monitor response schema, challenges, 429 rate, p95 latency, empty MP4 results, and redirect hosts.
- Kill switch: `ENABLE_TWITTERSAVER_PROVIDER=false`.
## Pilot closure evidence

ADR-0017 excludes TwitterSaver from the first X production evidence checkpoint. The Provider
remains disabled and independently reviewable; its technical Canary evidence does not establish
production permission and cannot satisfy the SSSTwitter/X/NL evidence index.
