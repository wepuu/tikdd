# Work Item 99 — LocoLoader low-quota multi-platform routing

## Scope

Productize the existing LocoLoader xHamster adapter with a shared, fail-closed extraction budget
and platform-scoped manifest capabilities. LocoLoader remains disabled by default; this item does
not create a rollout rule or enable production traffic. SaveTheVideo remains deferred after its
NL-side protocol attempts ended in `1002 Unable to download`.

## Implementation

- Added a Redis-backed `locoloader / nl` extraction budget: two POST reservations per six-hour
  window by default, one in-flight reservation, and one-second spacing. A reservation is consumed
  before the extraction POST and release clears only the short in-flight lease.
- Added deterministic in-memory budget coverage for adapter tests and bounded configuration parsing
  for `LOCOLOADER_MAX_EXTRACTIONS`, `LOCOLOADER_QUOTA_WINDOW_MS`,
  `LOCOLOADER_MAX_CONCURRENCY`, and `LOCOLOADER_MIN_INTERVAL_MS`.
- Extended the manifest to expose `xhamster`, `x`, `tiktok`, and `facebook` separately. The
  runtime default is `LOCOLOADER_APPROVED_PLATFORMS=xhamster`; only xHamster has
  `deliveryModes=[redirect]` and the audited `locoloader-xhamster-media-v1` policy.
- Kept the adapter's one bounded landing-cookie/form-key sequence and no-retry boundary. Budget
  exhaustion returns `provider_rate_limited` with fallback allowed before any upstream POST.
- No public contract, database migration, Provider URL, quota identity, or media proxy was added.

## Verification

Targeted LocoLoader, activation, and production-route tests cover the dynamic key, xHamster host
boundary, duplicate MP4 normalization, platform-scoped capabilities, configuration subset checks,
and the two-token budget. The full `pnpm check` remains the release gate. Production rollout is a
separate owner-authorized action after CI, exact-SHA image verification, backup, and two browser
downloads of distinct public xHamster samples.
