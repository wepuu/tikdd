# @tikdd/route-policy

Internal runtime projection for published Provider preference order and narrowing per-route
concurrency caps.

This package is not an authorization source. Workers evaluate the Provider manifest, rollout,
Pilot Guard, circuit, and distributed concurrency boundaries before a published preference can
affect ordering. Missing, malformed, stale, or unavailable policy projections fall back to the
manifest order; they never invent a rollout grant or clear a restriction.

PostgreSQL is authoritative. Redis contains one versioned, expiring, compare-and-set snapshot and
rejects an older compiler revision. Drafts, owner subjects, reasons, command identifiers, and
receipts never enter the runtime snapshot.
