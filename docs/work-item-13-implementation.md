# Work item 13: Provider capability evidence and distributed first-choice routing

Work item 13 separates code-owned capability evidence, rollout admission, and deterministic
first-choice traffic distribution. It does not add or enable a new live Provider.

## Delivered

- Every Provider capability declares an evidence status. Only `delivery_verified` capabilities may
  advertise a delivery mode and enter production routing.
- `canary_failed` records current negative evidence without erasing a declared capability or
  generalizing one failed URL to an unsupported platform.
- Scheduled verification is pinned to the exact Provider/platform/authorized URL tuple, so fallback
  cannot misattribute another Provider's success.
- Route policies persist and project `trafficShares` separately from rollout admission.
- The Router uses a stable task/platform/region hash to select one first Provider, then retains the
  published sequential fallback order.
- Admin displays first-choice traffic share separately from rollout admission and requires either no
  shares or a complete 10,000-basis-point distribution.
- The platform catalog retains only reviewed planned families with an independent current yt-dlp
  extractor entry; recognition is not a production-support or SEO claim.

## Removed from scope

A previously considered compatibility integration was withdrawn before commit because its runtime
is no longer usable. No integration-specific runtime, setting, Provider identifier, Fixture,
commercial source, or verification record remains in the repository.

## Safety boundary

- Traffic shares select one first attempt and never fan out requests.
- Rollout, region, health, circuit, concurrency, deadline, and maximum-attempt gates remain
  authoritative.
- Public OpenAPI and resolve-result models expose neither Provider selection details nor candidate
  URLs.
- Deterministic CI performs no live Provider or media request.
