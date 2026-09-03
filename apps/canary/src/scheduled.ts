import { randomUUID } from "node:crypto";
import {
  OperationalServiceRepository,
  createDatabasePool,
  operationalCadenceMs,
  operationalFreshnessGraceMs
} from "@tikdd/persistence";
import { loadCanarySchedulerConfiguration } from "./configuration";
import { executeCanaryRun } from "./runtime";
import { classifyCanaryExecution } from "./supervision";

const configuration = loadCanarySchedulerConfiguration();
const startedAt = new Date();
const runId = randomUUID();
const pool = createDatabasePool();
const status = new OperationalServiceRepository(pool);
await status.markStarted({
  service: "canary",
  deployment: configuration.deployment,
  runId,
  startedAt,
  cadenceMs: operationalCadenceMs.canary,
  graceMs: operationalFreshnessGraceMs.canary
});

let runtime: Awaited<ReturnType<typeof executeCanaryRun>> | undefined;
try {
  runtime = await executeCanaryRun();
  const summary = runtime.summary;
  const classification = classifyCanaryExecution(summary);
  await status.recordFinished({
    service: "canary",
    deployment: configuration.deployment,
    runId,
    state: classification.state,
    leaseState: classification.leaseState,
    startedAt,
    finishedAt: new Date(),
    cadenceMs: operationalCadenceMs.canary,
    graceMs: operationalFreshnessGraceMs.canary,
    lastErrorCode: classification.lastErrorCode,
    sanitizedSummary: {
      sampleCount: summary.sampleCount,
      succeeded: summary.succeeded,
      failed: summary.failed,
      durationMs: summary.durationMs,
      errorCount: summary.errorCount
    }
  });
  process.stdout.write(`${JSON.stringify({ service: "canary", state: classification.state, ...summary })}\n`);
  if (classification.state !== "completed") process.exitCode = 1;
} catch (error) {
  await status.recordFinished({
    service: "canary",
    deployment: configuration.deployment,
    runId,
    state: "failed",
    leaseState: "unknown",
    startedAt,
    finishedAt: new Date(),
    cadenceMs: operationalCadenceMs.canary,
    graceMs: operationalFreshnessGraceMs.canary,
    lastErrorCode: "startup_failure",
    sanitizedSummary: { sampleCount: 0, succeeded: 0, failed: 0, durationMs: 0, errorCount: 1 }
  }).catch(() => undefined);
  process.stderr.write("Scheduled Canary failed; inspect protected operational status.\n");
  process.exitCode = 1;
} finally {
  await runtime?.close();
  await pool.end();
}
