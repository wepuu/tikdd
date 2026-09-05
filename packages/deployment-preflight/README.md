# @tikdd/deployment-preflight

This internal package runs the personal-site deployment safety checks and issues short-lived,
runtime-bound attestations only for a complete technical preflight. It never grants rollout
traffic, stores secrets, or creates an audit/approval workflow.

Every scoped Provider is checked against its deployed runtime Manifest. A ready report requires an
enabled, delivery-verified platform capability whose explicit region list (or an existing reviewed
`"*"` declaration) admits the concrete deployment region. Owner assertions and reachable egress
cannot substitute for this capability check.

API and Worker processes that label tasks `internal` must verify short-lived signed attestations
before startup. Attestations are bound to the exact service role, resolve queue, deployment,
region, Provider set, and relevant least-privilege runtime controls. API and Worker therefore use
separate attestations and do not need each other's secrets. Public/development processes remain
unchanged.
