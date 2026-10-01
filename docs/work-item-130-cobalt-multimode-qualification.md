# Work Item 130: Cobalt multi-mode production qualification

## Scope

Work Item 130 promotes the Work Item 129 protocol implementation to a closed-gate production
qualification. It does not grant Cobalt traffic by itself. TikTok is the first conditional
secondary-route candidate; X and Facebook are evidence-only in this batch, and Instagram is tested
last because the previous batch returned a deterministic no-media result.

## Qualification runner

The `cobalt-multimode-qualification` release operation reads an operator-created mode-600 JSON file
from `/run/tikdd/cobalt-qualification-input.json`. It accepts at most eight samples and at most two
samples per reviewed core platform, validates every source through `@tikdd/platform`, executes
requests sequentially with a ten-second interval and no automatic retry, and deletes the temporary
input when the operation exits.

The input must be owned by the pinned non-root service identity `1000:1000` with mode `600`.
Validating both ownership and mode prevents a root-owned bind mount from passing host checks and
then failing unreadable inside the one-shot container.

Output is limited to sample ID, platform, response mode, HTTP status, normalized media and candidate
counts, media kinds, versioned Host policy IDs, local-processing operations, duration, and a typed
failure code. It never prints the source URL, response body, API key, full media URL, signed tunnel
descriptor, Cookie, or request headers.

The one-shot service uses the dedicated `cobalt-ops` Compose profile. Ordinary `ops` migration,
preflight, canary, evidence, and cleanup commands therefore do not activate or depend on Cobalt.

## Production sequence

1. Merge and deploy the exact GitHub-built SHA with all Cobalt gates and capabilities empty.
2. Publish only `https://media.tikdd.cc/tunnel`; keep the authenticated API private.
3. Run two samples per platform in the order TikTok, X, Facebook, Instagram.
4. Audit actual redirect, picker, tunnel, or local-processing delivery independently.
5. Only a two-sample TikTok result with successful browser delivery can add an explicit
   `tiktok:<mode>` capability and a unique secondary rollout rule.

Existing primary Providers stay ahead of Cobalt. A failed qualification closes normally without
changing Worker configuration or public traffic.

## Production result

The exact `main@a5b85e7902d6aa68529f351c23b8dbdaefbce0fc` GitHub images were deployed after an
input-ownership repair. The production Worker retained empty Cobalt capabilities and all three
Cobalt gates remained false.

The eight-sample isolated run produced the following sanitized result:

- TikTok resolved two of two as `tunnel` with one MP4 candidate each.
- X resolved two of two as one `picker` and one `redirect`.
- Facebook resolved two of two as `redirect`.
- Instagram resolved one of two as `redirect`; the second returned HTTP 400.

Both TikTok tunnel descriptors returned `206 video/mp4`, non-zero bytes, attachment disposition and
the exact Web-origin CORS response from the local direct exit. Both also returned `206 video/mp4`
through the local v2rayN exit. The NL public-origin exit returned HTTP 403, so the existing
three-exit qualification remains incomplete. TikTok stays `proxy-only`; no production key scope,
Worker gate, capability or rollout rule was changed. The isolated containers, UUID key, input and
signed descriptors were destroyed after the audit.

The NL deployment renders the Nginx log-directory placeholder to the existing aaPanel
`/www/wwwlogs` path. This prevents the Cobalt media vhost from assuming a distribution-specific
`/var/log/nginx` layout while retaining query-free tunnel access logs.
