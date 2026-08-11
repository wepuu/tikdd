# @tikdd/deployment-preflight

This internal package runs the personal-site deployment safety checks and issues short-lived,
runtime-bound attestations only for a complete technical preflight. It never grants rollout
traffic, stores secrets, or creates an audit/approval workflow.

API and Worker processes that label tasks `internal` must verify the same signed attestation before
startup. Public/development processes remain unchanged.
