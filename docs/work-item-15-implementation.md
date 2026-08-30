# Work Item 15 implementation record — X production configuration consistency

- Status: implemented; operational evidence gates remain pending
- Date: 2026-08-30
- Branch: `codex/work-item-15-x-production-consistency`
- Rebaseline: `rebaseline-2026-08-30`
- Production region: `nl`

## Previous contradiction

The reviewed deployment plan selected deployment `tikdd` in region `nl` and named TwitterSaver and
SSSTwitter as the intended deliverable X pair. Both runtime Manifests admitted only `global` and
`canary-global`. Router region filtering therefore rejected both Providers before rollout, health,
circuit, concurrency, or fallback decisions. The preflight nevertheless accepted owner assertion
booleans and could report ready without reading the deployed Manifest capabilities.

## Region model preserved

- `nl` is the concrete production Worker region. Qualification, attempts, health, circuits, route
  policy, rollout, and evidence for the intended deployment use this exact slug.
- `global` is the existing single-region local-development and historical-attempt backfill slug. It
  is a concrete identifier, not a wildcard and not an alias for `nl`.
- `canary-global` is the existing isolated technical-Canary region required by the scheduled Canary
  runtime. It does not satisfy `nl` production evidence.
- `"*"` retains its previously reviewed Manifest wildcard semantics where already declared. Work
  Item 15 does not add it or reinterpret `global` as a wildcard.

ADR-0006 explicitly requires production deployments to use their concrete Worker-region slug. The
checked-in preflight already records the project owner's terms and production-use confirmation for
both intended Providers in the `nl` scope. Adding the narrow explicit `nl` entries is therefore
consistent with existing architecture and does not make region state database-owned or Admin
editable.

## Manifest changes

- TwitterSaver/X regions: `nl`, `global`, `canary-global`.
- SSSTwitter/X regions: `nl`, `global`, `canary-global`.
- Provider priorities, evidence status, delivery modes, timeouts, Host policies, HTTP behavior, and
  unrelated platform capabilities are unchanged.
- Both adapters remain disabled by default. Runtime approval flags and all independent rollout,
  health, circuit, Delivery, and evidence gates remain required.

Deterministic Router tests prove both X Providers are Manifest- and delivery-eligible in `nl` when
an explicit test rollout source allows them, while preserving primary priority and sequential
fallback. A separate production-mode test proves that Manifest eligibility alone makes zero
Provider calls when no rollout grant exists.

## SSSTwitter scheduled Canary outcome

The project owner authorized the exact tuple `ssstwitter-x-recurring-001` / `ssstwitter` / `x` /
`https://x.com/SpaceX/status/2093477720638341395?s=20` on 2026-08-30 for recurring bounded scheduled
technical Canary health and qualification checks. It is now present in
`config/provider-canaries.json` and remains authorized only until explicit owner revocation or
configuration removal.

The scope permits submission of that exact public URL to SSSTwitter and the existing sanitized
measurements only. It does not permit media-body downloads, account cookies, authenticated X
sessions, private content, challenge or access-control bypass, expanded media probing, production
traffic, or rollout allocation. Existing scheduled-Canary safety controls remain mandatory. No live
Provider request was made while implementing Work Item 15.

The schema and tests validate the checked-in exact tuple, SSSTwitter as a supported Provider,
Provider/platform/URL tuple uniqueness, filter intersection, malformed identifiers, and exact
selection. Other Provider or URL combinations are not implied by this authorization.

## Deployment-preflight hardening

The preflight now consumes the deployed runtime-validated Provider Manifests rather than copying
capability declarations. For every Provider in the complete reviewed X scope it fails closed when:

- the Manifest is missing, duplicated, or disabled;
- the X capability is absent;
- the concrete deployment region is not admitted;
- the capability is not `delivery_verified` or has no reviewed delivery mode.

The report contains only bounded Provider/platform/region identifiers and actionable reason codes,
for example `deployment_region_not_admitted:ssstwitter:x:nl`. It exposes no upstream URLs, Host
payloads, headers, credentials, or secrets. A ready attestation cannot be issued while any of these
checks is blocked.

The preflight application constructs the inventory from the real TwitterSaver, DLPanda, and
SSSTwitter classes with their current runtime enabled state. It does not create a second capability
registry.

## Deterministic verification coverage

Tests cover:

- valid `nl` scope with both intended delivery-verified X capabilities;
- one intended Provider missing `nl`;
- both intended Providers missing `nl`;
- a required capability losing delivery eligibility;
- both Providers being considered in `nl` with explicit test-only rollout permission;
- absence of any production Provider call when rollout permission is absent;
- existing Canary tuple uniqueness and exact Provider selection behavior;
- the checked-in recurring SSSTwitter/X tuple exactly matches the owner-authorized URL.

## Remaining operational requirements

1. Work Item 16 must provide reproducible application deployment; this Work Item creates no
   production resources.
2. Work Item 17 must provide recurring scheduling/supervision and freshness observations.
3. A real deployment preflight must use current signals and runtime secrets.
4. Three internal calibration days, policy review/lock, staged pilot, seven healthy daily reviews,
   and real browser delivery verification remain pending.

The X Production Evidence Gate remains incomplete. Work Item 15 creates no rollout rule, allocation,
guard relaxation, database mutation, production traffic, or Provider network request.

## Architecture decision

No ADR is required. The implementation adds an explicitly reviewed concrete region and makes the
existing preflight enforce current Manifest capability. Region matching, Provider selection,
capability authority, persistence, task states, public contracts, and Delivery boundaries are
unchanged.
