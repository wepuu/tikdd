# Work Item 16 implementation record

- Status: Phase B complete; Phase C1.1 same-host cutover preparation in progress; deployment pending
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

## Phase C1 historical audit

The read-only NL host audit is recorded in
[the host readiness audit](work-item-16-host-readiness-audit.md) against Git SHA
`14ba0fef376ce568ec89eb388a7ac3b33541d25b`. Its historical conclusion remains
`NOT READY FOR DEPLOYMENT`. No production state was changed.

## Phase C1.1 owner decisions and preparation

The audited VPS remains the approved production target; neither another VPS nor an 8 GB RAM upgrade
is a prerequisite. The new stack must coexist with permanent shared MySQL, host Redis, Nginx,
PHP-FPM, panel services and unrelated websites. Those services are never TikDD lifecycle targets or
reclaimable capacity. New private TikDD PostgreSQL and TikDD Redis containers remain architecturally
required and intentionally coexist with the host datastores.

The production topology now reserves explicit Docker subnets, supplies application containers with
a reviewed supplemental Secret GID, excludes Admin from the continuous deploy path and requires a
read-only host/PHP/MySQL/host-Redis resource gate after each incremental startup step. The order is
PostgreSQL, TikDD Redis, migration, API, Delivery, Worker and Web. Operational workloads and Admin
remain one-shot/on-demand and Work Item 17 is unchanged.

Only a component proven `legacy-TikDD-exclusive` can be stopped after new-stack and public-ingress
verification. Source, data and definitions remain intact during the rollback-confidence period.
Shared MySQL, host Redis, shared PHP-FPM/Nginx/panel and unrelated sites are explicitly excluded.

The first empty PostgreSQL directory may be initialized without pre-existing off-host backup only
under an explicit single-use confirmation. Once production data can exist, encrypted off-host
PostgreSQL backup and restore testing become P0 hardening. Existing MySQL/site backup jobs do not
prove PostgreSQL protection.

Phase C1.1 offline acceptance rendered and created the explicit networks, proved the supplemental
Secret GID inside an unprivileged application container, applied all migrations, brought the full
public/Admin test topology healthy, preserved fail-closed Canary/preflight behavior and removed the
exact smoke project afterward. The minimum continuously running set observed approximately
720–750 MiB idle on Docker Desktop; the Admin pair raised the full test topology to approximately
1.05–1.08 GiB.
These values include both private TikDD datastores but remain non-production observations; the NL
stage gate is authoritative.
