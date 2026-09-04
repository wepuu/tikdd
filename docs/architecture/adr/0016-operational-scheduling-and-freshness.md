# ADR-0016 — production operational scheduling and freshness supervision

- Status: Accepted
- Date: 2026-09-03
- Scope: Work Item 17 scheduled Canary, evidence evaluator, and cleanup services

## Decision

Host `systemd` timers own cadence and reboot persistence. Each timer invokes a repository-owned
wrapper from the reviewed release directory. The wrapper takes a shared deployment lock and runs a
Docker Compose one-shot service with `--no-deps`; it never starts or replaces the continuously
running application stack.

Compose remains the execution-isolation boundary: scheduled Canary joins the private data and
Provider-egress networks, while scheduled evidence, cleanup, and operational-readiness jobs join
the private data network only. Existing manual `canary`, `evidence`, `cleanup`, and
`cleanup-dry-run` services and commands remain unchanged.

Redis leases remain the distributed singleton and overlap authority. The deployment `flock` only
prevents a scheduled job from running against a half-switched release. Neither systemd nor the
host wrapper decides Provider capability, rollout, health, or qualification.

The PostgreSQL `operational_service_status` table is the authoritative bounded read model for
sanitized scheduler freshness for exactly `canary`, `evidence`, and `cleanup`. It records the
current run, lease state, expected/stale windows, bounded consecutive failures, a controlled error
code, and safe aggregate summaries. Provider payloads, URLs, credentials, cookies, signed links,
tokens, and upstream responses are excluded. Existing canary measurements and evaluator history
remain the domain evidence authorities.

## Freshness contract

The explicit production cadences are cleanup 60 seconds, evidence 5 minutes, and Canary 15
minutes. The status row stores `next_expected_at` and `stale_after_at`; the bounded grace windows
are 30 seconds, 120 seconds, and 300 seconds respectively. A missing row, failed execution,
lease-unavailable execution, or stale row is not ready. A late row inside grace is degraded and is
also not ready. Only a completed run with a released lease and fresh timestamps is ready.

## Canary boundary

Recurring selection is machine-restricted to `scheduledCanaryIds` in `config/provider-canaries.json`.
The production list contains exactly `ssstwitter-x-recurring-001`, whose tuple is SSSTwitter/X in
`canary-global`. Manual definitions remain available only through manual commands and do not become
recurring automatically. The scheduled service has its own authorization flag and does not alter
the public Worker flags or the `ssstwitter/x/nl` allocation.

## Consequences

- A reboot may cause a persistent timer to run once immediately, after which normal cadence resumes.
- A scheduled job can fail without making a Provider measurement look like scheduler failure; the
  Canary status remains `completed` when the run and measurement persistence succeeded, even when
  one or more Provider samples failed.
- Lane B can read a sanitized database projection without SSH or systemd parsing.
- Backup cadence and restore drills remain outside this decision; P0-DR-01 is already complete.
