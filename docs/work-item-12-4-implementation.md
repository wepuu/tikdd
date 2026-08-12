# Work item 12.4 implementation — Provider route policy and bounded controls

## Outcome

TikDD now has its first mutable owner-control-plane domain. One exact `(platform, region)` policy
can be drafted, compared, published, discarded, or rolled back without turning the database into a
second Provider capability source.

The Admin shows the Manifest baseline, current published revision, current draft, and calculated
effective order. Unlisted eligible Providers remain after the explicit preference list in Manifest
order, preserving sequential bounded fallback.

## Safety and authority

- Every command requires the authenticated owner, exact same-origin request, subject-bound CSRF
  token, bounded reason, exact typed confirmation, idempotency key, and expected revision.
- The server revalidates platform, Provider, region, production enablement, mock exclusion,
  concurrency maximum, and duplicate entries against current code-owned catalogs and manifests.
- A route policy can order eligible Providers or narrow concurrency. It cannot recognize a host,
  enable a Provider, create delivery authority, clear a circuit, override a deny/Guard, or introduce
  parallel fallback.
- Published staged allocation rules remain deny-first rollout rules. Pilot Guard and circuit checks
  still run before preference ordering.
- Exact pause and emergency deny write only a zero-allocation Admin deny. Resume expires that exact
  deny and never writes `enabled=true` or a positive grant.
- A manual probe accepts no URL. It selects an already authorized server-side canary definition,
  acquires one exact Redis lease, enforces a 25-second deadline, stores only sanitized aggregate
  evidence, and fails closed when canaries are not explicitly authorized.

## Durable and runtime flow

1. PostgreSQL row locks and expected head revisions serialize a command.
2. An HMAC digest binds the idempotency key; reuse with different input conflicts.
3. Drafts are immutable revisions and never enter Worker runtime state.
4. Publish or rollback creates a new immutable revision and atomically applies its staged rollout
   rules.
5. A monotonic projection revision compiles all published policies for the concrete region.
6. Redis compare-and-set rejects an older route-policy or rollout compiler.
7. The receipt becomes `propagated` only after both snapshots are read back at the expected
   revision. Redis failure remains `propagation_failed`.
8. Worker durable fallback reconstructs the sanitized runtime snapshot from PostgreSQL; drafts,
   reasons, actor subjects, command IDs, and CSRF material never enter it.

## Runtime integration

`ProviderRouter` asks the route-policy source while ranking a task. A fresh published explicit
position ranks before Manifest priority; unspecified Providers retain their original relative
order. The selected narrowing cap is passed to distributed admission control, which applies
`min(code-owned limit, published override)` and rejects an attempted widening.

Missing or malformed preference state falls back to Manifest order. It does not change rollout,
Pilot Guard, circuit, deadline, terminal-error, or maximum-attempt behavior.

## Admin experience

The Routing Observatory now includes a guarded policy workspace with:

- baseline, published, draft, and effective comparison;
- accessible order controls, staged allocation, and optional narrowing concurrency fields;
- bounded reason and exact scope confirmation;
- save draft, publish, discard, rollback, pause, emergency deny, resume, and preset probe actions;
- honest baseline, draft, propagating, propagated, conflict, and failure feedback.

The existing signal-runway direction remains intact. The editor collapses to one column on mobile
and its route rows reflow without document-level horizontal overflow.

## Verification

- `pnpm test:work-item-12-4`: 12 files and 52 tests passed.
- Targeted type checks passed for Admin, Admin API, Worker, Provider router, admission control,
  persistence, Admin contracts, and route-policy projection packages.
- Migration `0012_route_policy_controls.sql` applied successfully to local Docker PostgreSQL;
  PostgreSQL and Redis were healthy.
- A real Admin browser session loaded sanitized state through the Next same-origin boundary. A
  draft was saved and observed at revision 1, then discarded; no policy or rollout publication was
  left active.
- At the mobile breakpoint, document client width and scroll width were both 375px and the editor
  collapsed to one column. Browser console contained no errors.
- Live QA did not run a third-party probe or submit an external URL.

## Next step

Work item 12.5 adds platform presentation and publication readiness without making Admin an owner
of recognized hosts, extractor keys, Provider capabilities, or delivery allowlists.
