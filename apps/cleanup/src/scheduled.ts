import { randomUUID } from "node:crypto";
import {
  OperationalServiceRepository,
  createDatabasePool,
  operationalCadenceMs,
  operationalFreshnessGraceMs
} from "@tikdd/persistence";
import { loadCleanupConfiguration } from "./configuration";
import { executeCleanup } from "./runtime";

const configuration = loadCleanupConfiguration();
const startedAt = new Date();
const runId = randomUUID();
const pool = createDatabasePool();
const status = new OperationalServiceRepository(pool);
await status.markStarted({
  service: "cleanup",
  deployment: configuration.deployment,
  runId,
  startedAt,
  cadenceMs: operationalCadenceMs.cleanup,
  graceMs: operationalFreshnessGraceMs.cleanup
});

let runtime: Awaited<ReturnType<typeof executeCleanup>> | undefined;
try {
  runtime = await executeCleanup(false);
  const metrics = runtime.metrics;
  const state = !metrics.leaseAcquired
    ? "lease_unavailable"
    : metrics.errors > 0
      ? "failed"
      : "completed";
  await status.recordFinished({
    service: "cleanup",
    deployment: configuration.deployment,
    runId,
    state,
    leaseState: metrics.leaseAcquired ? "released" : "unavailable",
    startedAt,
    finishedAt: new Date(metrics.finishedAt),
    cadenceMs: operationalCadenceMs.cleanup,
    graceMs: operationalFreshnessGraceMs.cleanup,
    lastErrorCode: state === "lease_unavailable" ? "lease_unavailable" : state === "failed" ? "runtime_failure" : null,
    sanitizedSummary: {
      mode: metrics.mode,
      batches: metrics.batches,
      deliveryTickets: metrics.rows.deliveryTickets,
      deliveryOutcomes: metrics.rows.deliveryOutcomes,
      deliveryCandidates: metrics.rows.deliveryCandidates,
      canaryMeasurements: metrics.rows.canaryMeasurements,
      errors: metrics.errors,
      failedStage: metrics.failedStage,
      stoppedReason: metrics.stoppedReason,
      durationMs: metrics.durationMs
    }
  });
  process.stdout.write(`${JSON.stringify({ service: "cleanup", state, ...metrics })}\n`);
  if (state !== "completed") process.exitCode = 1;
} catch (error) {
  await status.recordFinished({
    service: "cleanup",
    deployment: configuration.deployment,
    runId,
    state: "failed",
    leaseState: "unknown",
    startedAt,
    finishedAt: new Date(),
    cadenceMs: operationalCadenceMs.cleanup,
    graceMs: operationalFreshnessGraceMs.cleanup,
    lastErrorCode: "startup_failure",
    sanitizedSummary: { mode: "execute", batches: 0, errors: 1, stoppedReason: "error", durationMs: 0 }
  }).catch(() => undefined);
  const errorCode = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "unknown")
    : error instanceof Error ? error.name : "unknown";
  process.stderr.write(`Scheduled cleanup failed; inspect protected operational status (code=${errorCode}).\n`);
  process.exitCode = 1;
} finally {
  await runtime?.close();
  await pool.end();
}
