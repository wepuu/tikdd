# Work Item 97 — Production truth repair and secondary-provider qualification

## Baseline

This item starts from `main@22b4ba37ee760404c1dea4efccb30c08a25eabea`, after the low-traffic
health policy deployment. Production routing and gates remain unchanged while this item is
validated.

## Findings

The production `beta:report` command failed on PostgreSQL because its task-status aggregate
grouped by the `status` alias of a `CASE` expression. PostgreSQL requires the expression (or an
outer query) to be grouped explicitly. The report therefore could not be used as an operational
source of truth even though the underlying task, attempt, and Delivery records were present.

The task-status query now computes the cleanup-aware effective terminal state in a CTE and groups
by `effective_status`. This preserves a retained normalized result or error after cleanup while
remaining valid PostgreSQL SQL. No migration or public endpoint is added.

## SocialDownloader Instagram qualification

Two sequential, anonymous NL checks were performed against the existing SocialDownloader
Instagram protocol. Each check used one parse request, followed by no media request because the
parse response was rejected. Both returned HTTP 403 with no usable media resource. No cookies,
login state, challenge token, Provider page handoff, or retry was used.

Result: Instagram remains `SaveFromIns → no fallback`. SocialDownloader remains available only
for its already reviewed platform capabilities. No Instagram Delivery policy, rollout rule,
manifest promotion, or production Provider traffic is created by this item.

Vimeo and Pinterest remain single-Provider Beta routes. Previously rejected candidates are not
retested in this item; a later batch requires a new owner-supplied candidate or clear protocol
change.

## Implementation

- `BetaOperabilityRepository` uses a named CTE query for cleanup-aware task status aggregation.
- A regression test asserts the CTE/grouping contract and exercises the repository query path.
- Existing Provider, rollout, circuit, Delivery, Admin, and SEO behavior is unchanged.

## Validation

- Persistence beta-operability tests: passed.
- SocialDownloader and ProviderRouter tests: passed.
- NL SocialDownloader Instagram qualification: two requests, both HTTP 403, no media.
- Temporary probe files were removed from the NL host and local `.tmp` after execution.

## Exit boundary

The production release may contain the statistics correction only. It must preserve all current
Provider gates and rollout allocations, keep Admin enabled, keep calibration disabled, and avoid
synthetic Provider traffic. A future secondary route requires two successful public samples,
explicit Delivery host validation, and an independent tuple rollout rule.
