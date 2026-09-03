import { type Pool, type QueryResultRow } from "pg";

export const operationalServices = ["canary", "evidence", "cleanup"] as const;
export type OperationalService = (typeof operationalServices)[number];
export const operationalStates = ["running", "completed", "degraded", "failed", "lease_unavailable"] as const;
export type OperationalServiceState = (typeof operationalStates)[number];
export const operationalLeaseStates = ["acquired", "unavailable", "released", "unknown"] as const;
export type OperationalLeaseState = (typeof operationalLeaseStates)[number];
export type OperationalFreshness = "missing" | "fresh" | "degraded" | "stale" | "failed";

export const operationalCadenceMs: Record<OperationalService, number> = {
  canary: 900_000,
  evidence: 300_000,
  cleanup: 60_000
};
export const operationalFreshnessGraceMs: Record<OperationalService, number> = {
  canary: 300_000,
  evidence: 120_000,
  cleanup: 30_000
};

export function calculateOperationalWindow(startedAt: Date, cadenceMs: number, graceMs: number): {
  nextExpectedAt: Date;
  staleAfterAt: Date;
} {
  assertDate(startedAt, "Operational window start time");
  assertWindow(cadenceMs, graceMs);
  const nextExpectedAt = new Date(startedAt.getTime() + cadenceMs);
  return { nextExpectedAt, staleAfterAt: new Date(nextExpectedAt.getTime() + graceMs) };
}

export function nextConsecutiveFailures(previous: number, state: OperationalServiceState): number {
  if (!Number.isInteger(previous) || previous < 0) throw new Error("Operational failure count is invalid.");
  return state === "completed" ? 0 : Math.min(previous + 1, 10);
}

export interface OperationalServiceStatus {
  service: OperationalService;
  deployment: string;
  runId: string;
  state: OperationalServiceState;
  leaseState: OperationalLeaseState;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  nextExpectedAt: string;
  staleAfterAt: string;
  consecutiveFailures: number;
  lastErrorCode: string | null;
  sanitizedSummary: Record<string, number | string | null>;
  updatedAt: string;
}

export interface OperationalServiceProjection extends OperationalServiceStatus {
  freshness: OperationalFreshness;
  ready: boolean;
}

export interface OperationalServiceStartInput {
  service: OperationalService;
  deployment: string;
  runId: string;
  startedAt: Date;
  cadenceMs: number;
  graceMs: number;
}

export interface OperationalServiceFinishInput {
  service: OperationalService;
  deployment: string;
  runId: string;
  state: Exclude<OperationalServiceState, "running">;
  leaseState: OperationalLeaseState;
  startedAt: Date;
  finishedAt: Date;
  cadenceMs: number;
  graceMs: number;
  lastErrorCode: string | null;
  sanitizedSummary: Record<string, number | string | null>;
}

interface StatusRow extends QueryResultRow {
  service: OperationalService;
  deployment: string;
  run_id: string;
  state: OperationalServiceState;
  lease_state: OperationalLeaseState;
  last_started_at: Date | null;
  last_finished_at: Date | null;
  next_expected_at: Date;
  stale_after_at: Date;
  consecutive_failures: number;
  last_error_code: string | null;
  sanitized_summary: Record<string, number | string | null>;
  updated_at: Date;
}

function assertDate(value: Date, name: string): void {
  if (Number.isNaN(value.getTime())) throw new Error(`${name} is invalid.`);
}

function assertWindow(cadenceMs: number, graceMs: number): void {
  if (!Number.isInteger(cadenceMs) || cadenceMs < 1_000 || cadenceMs > 86_400_000) {
    throw new Error("Operational cadence is invalid.");
  }
  if (!Number.isInteger(graceMs) || graceMs < 1_000 || graceMs > 86_400_000) {
    throw new Error("Operational freshness grace is invalid.");
  }
}

function assertService(service: string): asserts service is OperationalService {
  if (!operationalServices.includes(service as OperationalService)) throw new Error("Operational service is invalid.");
}

function assertDeployment(deployment: string): void {
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(deployment)) throw new Error("Operational deployment is invalid.");
}

function assertRunId(runId: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(runId)) throw new Error("Operational run ID is invalid.");
}

function normalizeSummary(summary: Record<string, number | string | null>): Record<string, number | string | null> {
  if (summary === null || typeof summary !== "object" || Array.isArray(summary)) {
    throw new Error("Operational summary must be an object.");
  }
  const keys = Object.keys(summary);
  if (keys.length > 24) throw new Error("Operational summary has too many fields.");
  for (const key of keys) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(key) || /(url|token|cookie|payload|html|secret|candidate)/i.test(key)) {
      throw new Error("Operational summary contains an unsafe field.");
    }
    const value = summary[key];
    if (value !== null && typeof value !== "number" && typeof value !== "string") {
      throw new Error("Operational summary contains an unsafe value.");
    }
    if (typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000)) {
      throw new Error("Operational summary contains an invalid number.");
    }
    if (typeof value === "string" && value.length > 160) throw new Error("Operational summary contains a long value.");
  }
  return { ...summary };
}

function mapStatus(row: StatusRow): OperationalServiceStatus {
  return {
    service: row.service,
    deployment: row.deployment,
    runId: row.run_id,
    state: row.state,
    leaseState: row.lease_state,
    lastStartedAt: row.last_started_at?.toISOString() ?? null,
    lastFinishedAt: row.last_finished_at?.toISOString() ?? null,
    nextExpectedAt: row.next_expected_at.toISOString(),
    staleAfterAt: row.stale_after_at.toISOString(),
    consecutiveFailures: row.consecutive_failures,
    lastErrorCode: row.last_error_code,
    sanitizedSummary: row.sanitized_summary,
    updatedAt: row.updated_at.toISOString()
  };
}

export function projectOperationalStatus(status: OperationalServiceStatus | null, now = new Date()): OperationalServiceProjection | null {
  assertDate(now, "Operational projection clock");
  if (!status) return null;
  const staleAfter = new Date(status.staleAfterAt).getTime();
  const nextExpected = new Date(status.nextExpectedAt).getTime();
  let freshness: OperationalFreshness;
  if (status.state === "failed" || status.state === "lease_unavailable") freshness = "failed";
  else if (!status.lastFinishedAt) freshness = "missing";
  else if (now.getTime() > staleAfter) freshness = "stale";
  else if (now.getTime() > nextExpected) freshness = "degraded";
  else freshness = "fresh";
  return { ...status, freshness, ready: status.state === "completed" && freshness === "fresh" && status.leaseState === "released" };
}

export class OperationalServiceRepository {
  constructor(private readonly pool: Pool) {}

  async markStarted(input: OperationalServiceStartInput): Promise<void> {
    assertService(input.service); assertDeployment(input.deployment); assertRunId(input.runId);
    assertDate(input.startedAt, "Operational start time");
    const { nextExpectedAt: nextExpected, staleAfterAt: staleAfter } = calculateOperationalWindow(input.startedAt, input.cadenceMs, input.graceMs);
    await this.pool.query(
      `INSERT INTO operational_service_status
       (service,deployment,run_id,state,lease_state,last_started_at,next_expected_at,stale_after_at,
        consecutive_failures,last_error_code,sanitized_summary,updated_at)
       VALUES ($1,$2,$3,'running','acquired',$4,$5,$6,0,NULL,'{}'::jsonb,NOW())
       ON CONFLICT (service,deployment) DO UPDATE SET
         run_id=EXCLUDED.run_id,state='running',lease_state='acquired',last_started_at=EXCLUDED.last_started_at,
         next_expected_at=EXCLUDED.next_expected_at,stale_after_at=EXCLUDED.stale_after_at,
         last_error_code=NULL,sanitized_summary='{}'::jsonb,updated_at=NOW()` ,
      [input.service, input.deployment, input.runId, input.startedAt, nextExpected, staleAfter]
    );
  }

  async recordFinished(input: OperationalServiceFinishInput): Promise<void> {
    assertService(input.service); assertDeployment(input.deployment); assertRunId(input.runId);
    assertDate(input.startedAt, "Operational start time"); assertDate(input.finishedAt, "Operational finish time");
    if (input.finishedAt < input.startedAt) throw new Error("Operational finish precedes start.");
    const { nextExpectedAt: nextExpected, staleAfterAt: staleAfter } = calculateOperationalWindow(input.finishedAt, input.cadenceMs, input.graceMs);
    const summary = normalizeSummary(input.sanitizedSummary);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const previous = await client.query<{ consecutive_failures: number }>(
        "SELECT consecutive_failures FROM operational_service_status WHERE service=$1 AND deployment=$2 FOR UPDATE",
        [input.service, input.deployment]
      );
      const previousFailures = Number(previous.rows[0]?.consecutive_failures ?? 0);
      const failures = nextConsecutiveFailures(previousFailures, input.state);
      await client.query(
        `INSERT INTO operational_service_status
         (service,deployment,run_id,state,lease_state,last_started_at,last_finished_at,next_expected_at,stale_after_at,
          consecutive_failures,last_error_code,sanitized_summary,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,NOW())
         ON CONFLICT (service,deployment) DO UPDATE SET
           run_id=EXCLUDED.run_id,state=EXCLUDED.state,lease_state=EXCLUDED.lease_state,
           last_started_at=EXCLUDED.last_started_at,last_finished_at=EXCLUDED.last_finished_at,
           next_expected_at=EXCLUDED.next_expected_at,stale_after_at=EXCLUDED.stale_after_at,
           consecutive_failures=EXCLUDED.consecutive_failures,last_error_code=EXCLUDED.last_error_code,
           sanitized_summary=EXCLUDED.sanitized_summary,updated_at=NOW()` ,
        [input.service, input.deployment, input.runId, input.state, input.leaseState, input.startedAt,
          input.finishedAt, nextExpected, staleAfter, failures, input.lastErrorCode, JSON.stringify(summary)]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async get(service: OperationalService, deployment: string): Promise<OperationalServiceStatus | null> {
    assertService(service); assertDeployment(deployment);
    const result = await this.pool.query<StatusRow>(
      `SELECT service,deployment,run_id,state,lease_state,last_started_at,last_finished_at,next_expected_at,
         stale_after_at,consecutive_failures,last_error_code,sanitized_summary,updated_at
       FROM operational_service_status WHERE service=$1 AND deployment=$2`, [service, deployment]
    );
    return result.rows[0] ? mapStatus(result.rows[0]) : null;
  }

  async list(deployment: string, now = new Date()): Promise<OperationalServiceProjection[]> {
    assertDeployment(deployment); assertDate(now, "Operational projection clock");
    const result = await this.pool.query<StatusRow>(
      `SELECT service,deployment,run_id,state,lease_state,last_started_at,last_finished_at,next_expected_at,
         stale_after_at,consecutive_failures,last_error_code,sanitized_summary,updated_at
       FROM operational_service_status WHERE deployment=$1 ORDER BY service`, [deployment]
    );
    return result.rows.map((row) => projectOperationalStatus(mapStatus(row), now) as OperationalServiceProjection);
  }
}
