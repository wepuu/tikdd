import { OperationalServiceRepository, operationalServices, projectOperationalStatus } from "./operational-services";
import { createDatabasePool } from "./index";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
const deployment = process.env.TIKDD_OPERATIONAL_DEPLOYMENT ?? process.env.CLEANUP_DEPLOYMENT ?? "";
if (!deployment) throw new Error("TIKDD_OPERATIONAL_DEPLOYMENT is required.");

const pool = createDatabasePool(databaseUrl);
try {
  const repository = new OperationalServiceRepository(pool);
  const statuses = await repository.list(deployment);
  const byService = new Map(statuses.map((status) => [status.service, status]));
  const report = operationalServices.map((service) => {
    const status = byService.get(service);
    if (!status) return { service, deployment, state: "missing", freshness: "missing", ready: false };
    const projection = projectOperationalStatus(status);
    return {
      service,
      deployment,
      state: projection?.state ?? "invalid",
      freshness: projection?.freshness ?? "invalid",
      last_finished_at: projection?.lastFinishedAt ?? null,
      next_expected_at: projection?.nextExpectedAt ?? null,
      stale_after_at: projection?.staleAfterAt ?? null,
      lease_state: projection?.leaseState ?? "unknown",
      consecutive_failures: projection?.consecutiveFailures ?? 0,
      last_error_code: projection?.lastErrorCode ?? null,
      ready: projection?.ready === true
    };
  });
  process.stdout.write(`${JSON.stringify({ deployment, services: report })}\n`);
  if (report.some((service) => service.ready !== true)) process.exitCode = 1;
} finally {
  await pool.end();
}
