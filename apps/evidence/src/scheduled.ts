import { randomUUID } from "node:crypto";
import {
  OperationalServiceRepository,
  createDatabasePool,
  operationalCadenceMs,
  operationalFreshnessGraceMs
} from "@tikdd/persistence";
import { loadEvidenceConfiguration } from "./configuration";
import { executeEvidenceCycle } from "./runtime";

const configuration = loadEvidenceConfiguration();
const startedAt = new Date();
const runId = randomUUID();
const pool = createDatabasePool();
const status = new OperationalServiceRepository(pool);
await status.markStarted({
  service: "evidence",
  deployment: configuration.deployment,
  runId,
  startedAt,
  cadenceMs: operationalCadenceMs.evidence,
  graceMs: operationalFreshnessGraceMs.evidence
});

let execution: Awaited<ReturnType<typeof executeEvidenceCycle>> | undefined;
try {
  execution = await executeEvidenceCycle();
  const result = execution.result;
  const state = result.status === "lease_unavailable" ? "lease_unavailable" : result.status === "failed" ? "failed" : result.status === "partial" ? "degraded" : "completed";
  await status.recordFinished({
    service: "evidence",
    deployment: configuration.deployment,
    runId,
    state,
    leaseState: result.status === "lease_unavailable" ? "unavailable" : "released",
    startedAt,
    finishedAt: new Date(),
    cadenceMs: operationalCadenceMs.evidence,
    graceMs: operationalFreshnessGraceMs.evidence,
    lastErrorCode: state === "lease_unavailable" ? "lease_unavailable" : state === "failed" ? "runtime_failure" : null,
    sanitizedSummary: {
      tupleCount: result.tupleCount,
      changedGuardCount: result.changedGuardCount,
      rebuiltDayCount: result.rebuiltDayCount,
      reportedStatus: result.status
    }
  });
  process.stdout.write(`${JSON.stringify({ service: "evidence", state, ...result })}\n`);
  if (state !== "completed") process.exitCode = 1;
} catch {
  await status.recordFinished({
    service: "evidence",
    deployment: configuration.deployment,
    runId,
    state: "failed",
    leaseState: "unknown",
    startedAt,
    finishedAt: new Date(),
    cadenceMs: operationalCadenceMs.evidence,
    graceMs: operationalFreshnessGraceMs.evidence,
    lastErrorCode: "startup_failure",
    sanitizedSummary: { tupleCount: 0, changedGuardCount: 0, rebuiltDayCount: 0, reportedStatus: "failed" }
  }).catch(() => undefined);
  process.stderr.write("Scheduled evidence evaluation failed; inspect protected operational status.\n");
  process.exitCode = 1;
} finally {
  await execution?.close();
  await pool.end();
}
