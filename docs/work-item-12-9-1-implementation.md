# Work item 12.9.1 implementation

Status: complete on 2026-08-13.

## Outcome

TikDD now presents and queries Provider routing as one exact `(platform, region)` owner workflow:

`select scope → inspect Manifest capability → inspect live route → preview bounded fallback → edit guarded policy`

The change does not expand any Provider capability. Manifests and the runtime route-policy service
remain authoritative, and public resolve/delivery contracts are unchanged.

## Implemented

1. The Admin selector includes catalog, Manifest, and operational platforms instead of only current
   route observations.
2. The BFF accepts one validated `policyPlatform` read parameter and loads the corresponding
   platform/region policy even if no operational route exists.
3. One platform state drives the scope summary, capability matrix, route runway, refreshes, and
   route-policy confirmation. Platform switching cannot retain a policy from the prior platform.
4. The capability matrix is placed before runtime health and separates:
   - declared delivery capability;
   - current production eligibility;
   - resolution-only capability;
   - unsupported capability.
5. Platforms with no live route retain a readable Manifest policy baseline, while route-specific
   pause, deny, resume, and Probe actions remain unavailable.
6. Provider search has an accessible name, mobile layout is single-platform and two-column, and
   the wide route graph remains an explicitly scrollable secondary inspection surface.
7. The Admin stack launcher now constructs an ownership-checked stop plan, waits for the recorded
   build to disappear, preserves state when verification fails, and has stale-PID and stop-budget
   regression tests.

## Verification

- `vitest run scripts/admin-stack-core.test.mjs apps/admin/test/admin-api-client.test.ts apps/admin/test/console-model.test.ts`: 3 files, 14 tests passed.
- Admin TypeScript check passed.
- `admin:status` reports matching UI/API build `dev-msqq5hgm-c9097c` with ports `3001/4100` healthy.
- Real-browser Product Design QA passed on desktop and `390 × 844`; evidence and findings are in
  `docs/design/work-item-12-9-1-design-qa.md`.
- The Provider capability routing gate and repository-wide `pnpm check` are the final baseline gates.

## Boundaries retained

- No Provider, platform, delivery mode, Host rule, or production grant can be created in Admin.
- Resolution-only Providers cannot enter production order, allocation, or concurrency settings.
- Route-specific safety actions require an actual route projection and exact tuple confirmation.
- No real Provider request is sent by the 12.9.1 test gate.
