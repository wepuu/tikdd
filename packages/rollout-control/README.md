# @tikdd/rollout-control

This internal package owns runtime-validated provider rollout rules, deny-first evaluation,
deterministic task cohorts, revisioned Redis snapshots, and fail-closed authorization reads.

It does not own provider manifests, circuit health, task admission quotas, public API errors, or
delivery policy. The Provider Router applies its decision after static manifest eligibility and
before circuit state. PostgreSQL persistence is implemented by `RolloutRuleRepository` in
`@tikdd/persistence`; this package remains independent from the database driver.

Key invariants:

- any matching active deny wins;
- a fleet selector can deny but never grant;
- equally specific overlapping grants are invalid;
- cohorts use a keyed HMAC of stable rule ID and opaque task ID only;
- older snapshots cannot replace newer Redis or in-process state;
- missing or stale production authorization denies the provider;
- production mocks are rejected independently by both evaluation and the router.

See [ADR-0007](../../docs/architecture/adr/0007-rollout-admission-and-abuse-controls.md) and
[provider rollout operations](../../docs/provider-rollout-operations.md).
