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

The NL deployment renders the Nginx log-directory placeholder to the existing aaPanel
`/www/wwwlogs` path. This prevents the Cobalt media vhost from assuming a distribution-specific
`/var/log/nginx` layout while retaining query-free tunnel access logs.
