# Work Item 16 Phase B implementation record

- Status: implementation complete; real infrastructure inputs and deployment remain pending
- Date: 2026-08-30
- Branch: `codex/work-item-16-deployment-implementation`
- Deployment identity/region: `tikdd` / `nl`

Phase B implements the approved reproducible production foundation without touching a production
host. The authoritative operator instructions are in
[the production deployment runbook](production-deployment.md); the approved topology and rationale
remain in [the Phase A design](work-item-16-deployment-design.md).

The implementation adds three multi-stage image targets, a dedicated production Compose topology,
external file-to-environment secret bootstrap, private PostgreSQL/Redis persistence, an explicit
migration runner, a Manifest-driven preflight runner, manual operational jobs, loopback-only host
publications, minimal Docker networks, Admin shared-network-namespace isolation, host Nginx site
templates, immutable release metadata, deployment locking, rollback guidance and deterministic
offline verification.

Provider enablement, rollout allocation, Cloudflare resources, firewall state, production
migration, production host access and Work Item 17 scheduling are deliberately unchanged.

Offline acceptance built all three image targets, applied all 18 migrations to an isolated test
database, brought every long-running and Admin service healthy, verified the four loopback-only
publications, ran cleanup/evidence jobs, and proved Canary/preflight fail closed without
authorization or evidence. Approximate idle memory was 722 MiB without Admin and 1.03 GiB with the
on-demand Admin pair. The exact smoke containers, test secrets and named volumes were removed.
