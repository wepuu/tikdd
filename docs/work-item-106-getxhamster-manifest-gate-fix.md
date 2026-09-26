# Work Item 106 — GetXHamster manifest gate correction

## Problem

The first production activation attempt was fail-closed by `ProviderRouter`. GetXHamster
advertised a `redirect` delivery mode when its xHamster binding was marked as verified, but the
manifest still reported `fixture_verified`. The runtime schema correctly rejected that
contradictory capability and the Worker was restarted back to the disabled, healthy state.

## Fix

When `GETXHAMSTER_DELIVERY_VERIFIED_PLATFORMS` contains `xhamster`, the adapter now reports
`delivery_verified`; when it is empty, the capability remains unverified with no delivery mode.
This aligns the manifest with the existing activation and Delivery-policy gates. No public
contract, database migration, Host Policy, or retry behavior changes.

## Release boundary

Keep all GetXHamster gates and rollout disabled until the fix is merged, its exact-SHA images are
verified, and the Worker-only configuration apply is healthy. Then enable the three GetXHamster
gates and the unique `getxhamster / xhamster / nl` rollout rule by CAS for manual validation.
If activation or validation fails, close the rollout first and then the three gates.
