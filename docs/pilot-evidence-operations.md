# Pilot evidence operations

Work item 11.4 implements [ADR-0009](architecture/adr/0009-pilot-evidence-and-delivery-outcomes.md)
without changing public OpenAPI. `@tikdd/evidence` is separate from Web, API, resolver Workers,
delivery, canary, and cleanup.

## Runtime boundary

Every five minutes the service acquires `tikdd:evidence:v1:lease:<deployment>`, rebuilds the current
and preceding UTC source days, reads active locked policies and exact operator grants, then may
hold, reduce, deny, or mark a Guard eligible for review. PostgreSQL remains authoritative. Redis
key `tikdd:pilot-guard:v1:snapshot` is an expiring distribution snapshot and older revisions cannot
replace newer ones.

Missing, insufficient, stale, mixed-version, or wrong-class evidence never counts as healthy. A
healthy recovery window does not restore traffic: the Guard stays capped until operator review and
a separate rollout-rule change.

```dotenv
EVIDENCE_DEPLOYMENT=reviewed-region
EVIDENCE_OWNER_ID=evaluator.reviewed-region
EVIDENCE_INTERVAL_MS=300000
EVIDENCE_LEASE_TTL_MS=360000
EVIDENCE_REBUILD_DAYS=4
PILOT_GUARD_SNAPSHOT_TTL_MS=30000
```

Production requires explicit deployment and owner values. The service refuses ambiguous active
policies for one provider/platform/region tuple. It does not accept source URLs, task IDs, candidate
data, provider payloads, or public request parameters.

## Protected diagnostics

The API registers `/internal/v1/pilot-evidence` and `/internal/v1/pilot-evidence/export` only when
both values are configured:

```dotenv
PILOT_EVIDENCE_DIAGNOSTICS_TOKEN=<independent random token of at least 32 characters>
PILOT_EVIDENCE_DIAGNOSTICS_ACTOR_ID=operations.evidence-reader
```

Both routes require one exact provider/platform/region/class and a maximum 31-day UTC range. They
return aggregate freshness, sufficiency, locked policy version, Guard reason/cap, evaluator health,
and daily summaries only. Responses are `no-store` and `noindex`; exports stream JSON, write a
sanitized access audit, and create no server-side artifact. They are absent from public OpenAPI,
SEO pages, and consumer Web code.

## Commands and recovery

```sh
pnpm evidence:run
pnpm evidence:start
pnpm verify:evidence
pnpm verify:work-item-11
```

On evaluator failure, inspect the protected freshness and evaluator status, then check PostgreSQL,
the active policy version, operator grant revision, source retention, and Redis publication. A
stale required Guard fails Worker routing closed after its TTL. Recovery republishes current durable
state; it never reconstructs permission from Redis or clears a restriction automatically.

The deterministic verification uses synthetic PostgreSQL/Redis evidence, restores the previous
Guard snapshot, removes all verification rows, and never calls a live provider.
