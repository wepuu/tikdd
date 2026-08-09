import {
  PlatformIdSchema,
  ProviderFailureCodeSchema,
  RegionIdSchema,
  type Platform,
  type ProviderFailureCode
} from "@tikdd/contracts";
import { type Pool, type QueryResultRow } from "pg";

export interface CanaryMeasurementInput {
  runId: string;
  canaryId: string;
  providerId: string;
  platform: Platform;
  region: string;
  status: "succeeded" | "failed";
  failureCode: ProviderFailureCode | null;
  durationMs: number;
  formatCount: number | null;
  linkLifetimeMs: number | null;
  attemptCount: number;
  recordedAt: Date;
  expiresAt: Date;
}

export interface CanaryHealthSummary {
  canaryId: string;
  providerId: string;
  platform: string;
  region: string;
  sampleCount: number;
  successCount: number;
  latestStatus: "succeeded" | "failed";
  latestFailureCode: ProviderFailureCode | null;
  latencyP95Ms: number;
  averageFormatCount: number | null;
  minimumLinkLifetimeMs: number | null;
  averageFallbackDepth: number;
  lastRecordedAt: string;
  failureCounts: Partial<Record<ProviderFailureCode, number>>;
}

export interface AttemptRouteSummary {
  providerId: string;
  platform: string;
  region: string;
  attemptCount: number;
  failureCounts: Partial<Record<ProviderFailureCode, number>>;
}

export interface FallbackDepthSummary {
  taskCount: number;
  averageDepth: number;
  p95Depth: number;
  maximumDepth: number;
}

interface CanarySummaryRow extends QueryResultRow {
  canary_id: string;
  provider_id: string;
  platform: string;
  region: string;
  sample_count: number;
  success_count: number;
  latest_status: "succeeded" | "failed";
  latest_failure_code: ProviderFailureCode | null;
  latency_p95_ms: number;
  average_format_count: number | null;
  minimum_link_lifetime_ms: string | null;
  average_fallback_depth: number;
  last_recorded_at: Date;
}

interface FailureCountRow extends QueryResultRow {
  provider_id: string;
  platform: string;
  region: string;
  canary_id?: string;
  failure_code: ProviderFailureCode;
  failure_count: number;
}

function validateMeasurement(input: CanaryMeasurementInput): void {
  PlatformIdSchema.parse(input.platform);
  RegionIdSchema.parse(input.region);
  if (input.failureCode !== null) ProviderFailureCodeSchema.parse(input.failureCode);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.runId)) {
    throw new Error("Canary run ID is invalid.");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.canaryId)) {
    throw new Error("Canary ID is invalid.");
  }
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(input.providerId)) {
    throw new Error("Canary provider ID is invalid.");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.region)) {
    throw new Error("Canary region is invalid.");
  }
  for (const value of [input.durationMs, input.attemptCount]) {
    if (!Number.isInteger(value) || value < 0) throw new Error("Canary measurement is invalid.");
  }
  if (input.attemptCount > 100 || input.expiresAt <= input.recordedAt) {
    throw new Error("Canary measurement lifetime is invalid.");
  }
  if (
    (input.status === "succeeded" && (input.failureCode !== null || input.formatCount === null)) ||
    (input.status === "failed" && (input.failureCode === null || input.formatCount !== null))
  ) {
    throw new Error("Canary outcome fields are inconsistent.");
  }
}

export class OperationalDiagnosticsRepository {
  constructor(private readonly pool: Pool) {}

  async recordCanaryMeasurement(input: CanaryMeasurementInput): Promise<void> {
    validateMeasurement(input);
    await this.pool.query(
      `INSERT INTO provider_canary_measurements (
         run_id, canary_id, provider_id, platform, region, status, failure_code, duration_ms,
         format_count, link_lifetime_ms, attempt_count, fallback_depth, recorded_at, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
         GREATEST($11::smallint - 1, 0), $12, $13)
       ON CONFLICT (run_id, canary_id) DO NOTHING`,
      [
        input.runId,
        input.canaryId,
        input.providerId,
        input.platform,
        input.region,
        input.status,
        input.failureCode,
        input.durationMs,
        input.formatCount,
        input.linkLifetimeMs,
        input.attemptCount,
        input.recordedAt,
        input.expiresAt
      ]
    );
  }

  async listCanaryHealth(since: Date): Promise<CanaryHealthSummary[]> {
    const summaries = await this.pool.query<CanarySummaryRow>(
      `SELECT canary_id, provider_id, platform, region,
         count(*)::int AS sample_count,
         count(*) FILTER (WHERE status = 'succeeded')::int AS success_count,
         (array_agg(status ORDER BY recorded_at DESC, id DESC))[1] AS latest_status,
         (array_agg(failure_code ORDER BY recorded_at DESC, id DESC))[1] AS latest_failure_code,
         round(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms))::int AS latency_p95_ms,
         round(avg(format_count))::int AS average_format_count,
         min(link_lifetime_ms)::text AS minimum_link_lifetime_ms,
         round(avg(fallback_depth)::numeric, 2)::double precision AS average_fallback_depth,
         max(recorded_at) AS last_recorded_at
       FROM provider_canary_measurements
       WHERE recorded_at >= $1 AND expires_at > NOW()
       GROUP BY canary_id, provider_id, platform, region
       ORDER BY provider_id, platform, region, canary_id`,
      [since]
    );
    const failures = await this.pool.query<FailureCountRow>(
      `SELECT canary_id, provider_id, platform, region, failure_code,
         count(*)::int AS failure_count
       FROM provider_canary_measurements
       WHERE recorded_at >= $1 AND expires_at > NOW() AND failure_code IS NOT NULL
       GROUP BY canary_id, provider_id, platform, region, failure_code`,
      [since]
    );
    const failureMap = new Map<string, Partial<Record<ProviderFailureCode, number>>>();
    for (const row of failures.rows) {
      const key = `${row.canary_id}\0${row.provider_id}\0${row.platform}\0${row.region}`;
      const counts = failureMap.get(key) ?? {};
      counts[row.failure_code] = row.failure_count;
      failureMap.set(key, counts);
    }
    return summaries.rows.map((row) => ({
      canaryId: row.canary_id,
      providerId: row.provider_id,
      platform: row.platform,
      region: row.region,
      sampleCount: row.sample_count,
      successCount: row.success_count,
      latestStatus: row.latest_status,
      latestFailureCode: row.latest_failure_code,
      latencyP95Ms: row.latency_p95_ms,
      averageFormatCount: row.average_format_count,
      minimumLinkLifetimeMs: row.minimum_link_lifetime_ms === null ? null : Number(row.minimum_link_lifetime_ms),
      averageFallbackDepth: row.average_fallback_depth,
      lastRecordedAt: row.last_recorded_at.toISOString(),
      failureCounts:
        failureMap.get(`${row.canary_id}\0${row.provider_id}\0${row.platform}\0${row.region}`) ?? {}
    }));
  }

  async listAttemptRouteSummaries(since: Date): Promise<AttemptRouteSummary[]> {
    const totals = await this.pool.query<QueryResultRow & {
      provider_id: string; platform: string; region: string; attempt_count: number;
    }>(
      `SELECT provider_id, platform, region, count(*)::int AS attempt_count
       FROM provider_attempts WHERE finished_at >= $1
       GROUP BY provider_id, platform, region ORDER BY provider_id, platform, region`,
      [since]
    );
    const failures = await this.pool.query<FailureCountRow>(
      `SELECT provider_id, platform, region, failure_code, count(*)::int AS failure_count
       FROM provider_attempts
       WHERE finished_at >= $1 AND failure_code IS NOT NULL
       GROUP BY provider_id, platform, region, failure_code`,
      [since]
    );
    const failureMap = new Map<string, Partial<Record<ProviderFailureCode, number>>>();
    for (const row of failures.rows) {
      const key = `${row.provider_id}\0${row.platform}\0${row.region}`;
      const counts = failureMap.get(key) ?? {};
      counts[row.failure_code] = row.failure_count;
      failureMap.set(key, counts);
    }
    return totals.rows.map((row) => ({
      providerId: row.provider_id,
      platform: row.platform,
      region: row.region,
      attemptCount: row.attempt_count,
      failureCounts: failureMap.get(`${row.provider_id}\0${row.platform}\0${row.region}`) ?? {}
    }));
  }

  async getFallbackDepthSummary(since: Date): Promise<FallbackDepthSummary> {
    const result = await this.pool.query<QueryResultRow & {
      task_count: number; average_depth: number; p95_depth: number; maximum_depth: number;
    }>(
      `WITH task_depths AS (
         SELECT task_id, GREATEST(count(*) - 1, 0)::int AS depth
         FROM provider_attempts WHERE finished_at >= $1 GROUP BY task_id
       )
       SELECT count(*)::int AS task_count,
         COALESCE(round(avg(depth)::numeric, 2), 0)::double precision AS average_depth,
         COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY depth), 0)::int AS p95_depth,
         COALESCE(max(depth), 0)::int AS maximum_depth
       FROM task_depths`,
      [since]
    );
    const row = result.rows[0];
    return {
      taskCount: row?.task_count ?? 0,
      averageDepth: row?.average_depth ?? 0,
      p95Depth: row?.p95_depth ?? 0,
      maximumDepth: row?.maximum_depth ?? 0
    };
  }
}
