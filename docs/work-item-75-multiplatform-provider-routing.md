# Work Item 75 — Multi-platform Provider routing and Facebook Beta closeout

## Status

Implemented on `codex/wi75-multiplatform-provider-routing`; Facebook remains the only active
SocialDownloader production capability.

## Scope

SocialDownloader is modeled as one Provider with independent Facebook, X, TikTok, Instagram, and
YouTube capabilities. The Worker keeps a shared conservative request budget because the upstream
service may rate-limit the NL egress IP across platforms. Existing route, rollout, circuit, and
Delivery boundaries remain tuple-scoped and no Provider page or media proxy is introduced.

Facebook remains `FDown Isuru → SocialDownloader` with its reviewed redirect policy. The other
capabilities are visible for qualification and Admin inspection, but have no production delivery
mode and cannot be selected by a production router.

## Implementation

- SocialDownloader manifest now declares all five platform capabilities with independent status.
- Only Facebook is `delivery_verified` and exposes `redirect`.
- `SOCIALDOWNLOADER_APPROVED_PLATFORMS` defaults to `facebook` and is parsed as a bounded allowlist.
- `SOCIALDOWNLOADER_MAX_CONCURRENCY`, `SOCIALDOWNLOADER_MIN_INTERVAL_MS`, and
  `SOCIALDOWNLOADER_MAX_COOLDOWN_MS` control a fail-fast shared request budget.
- HTTP 429 responses honor `Retry-After` and set a bounded provider-wide cooldown.
- Diagnostics use the detected platform and do not include source URLs, Provider hosts, bodies,
  query values, cookies, tokens, or media addresses.
- Admin Beta Health now includes Facebook and remains read-only. The four cards stay responsive on
  desktop and collapse to one column on small screens.

## Qualification boundary

X and TikTok remain fixture-level Lab capabilities pending a second sample and browser handoff
audit. Instagram retains the observed failed second-sample evidence, and YouTube retains timeout
evidence. No rollout rule or gate was created for these capabilities.

The four manually verified Facebook samples are recorded as production acceptance evidence without
persisting their URLs. Facebook remains Beta and is not added to the sitemap in this item.

## Tests and release

- Provider tests cover capability declaration, unapproved-platform rejection, exact Facebook
  fallback, shared budget isolation, and rate-limit cooldown.
- Worker activation tests cover the platform allowlist and bounded budget settings.
- Admin and persistence tests cover the four-platform health aggregate.
- No database migration, public API change, or production Provider expansion is included.
