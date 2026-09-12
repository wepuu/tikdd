import type { ResolveTask } from "@tikdd/contracts";
import type { Pool, QueryResultRow } from "pg";

const betaPlatforms = ["x", "instagram", "tiktok"] as const;
export type BetaPlatform = (typeof betaPlatforms)[number];
export const BETA_PLATFORMS: readonly BetaPlatform[] = betaPlatforms;

type TaskStatus = ResolveTask["status"];

export interface BetaReportWindow {
  from: string;
  to: string;
  hours: number;
}

export interface BetaTaskSummary {
  total: number;
  succeeded: number;
  failed: number;
  expired: number;
  active: number;
  failureCounts: Record<string, number>;
}

export interface BetaAttemptSummary {
  total: number;
  succeeded: number;
  failed: number;
  successRate: number;
  failureCounts: Record<string, number>;
}

export interface BetaDeliverySummary {
  total: number;
  succeeded: number;
  failed: number;
  successRate: number;
  resultCounts: Record<string, number>;
}

export interface BetaReportBucket {
  latestEventAt: string | null;
  tasks: BetaTaskSummary;
  attempts: BetaAttemptSummary;
  deliveries: BetaDeliverySummary;
}

export interface BetaHealthReport {
  generatedAt: string;
  window: BetaReportWindow;
  platforms: readonly BetaPlatform[];
  latestEventAt: string | null;
  totals: BetaReportBucket;
  byPlatform: Record<BetaPlatform, BetaReportBucket>;
}

export interface BetaTaskStatusRow {
  platform: string;
  status: TaskStatus;
  count: number;
  latestAt: string | null;
}

export interface BetaTaskFailureRow {
  platform: string;
  failureCode: string | null;
  count: number;
}

export interface BetaAttemptRow {
  platform: string;
  status: "succeeded" | "failed";
  failureCode: string | null;
  count: number;
  latestAt: string | null;
}

export interface BetaDeliveryRow {
  platform: string;
  resultClass: string;
  count: number;
  latestAt: string | null;
}

export interface BetaReportRows {
  taskStatuses: readonly BetaTaskStatusRow[];
  taskFailures: readonly BetaTaskFailureRow[];
  attempts: readonly BetaAttemptRow[];
  deliveries: readonly BetaDeliveryRow[];
}

function emptyTasks(): BetaTaskSummary {
  return { total: 0, succeeded: 0, failed: 0, expired: 0, active: 0, failureCounts: {} };
}

function emptyAttempts(): BetaAttemptSummary {
  return { total: 0, succeeded: 0, failed: 0, successRate: 0, failureCounts: {} };
}

function emptyDeliveries(): BetaDeliverySummary {
  return { total: 0, succeeded: 0, failed: 0, successRate: 0, resultCounts: {} };
}

function emptyBucket(): BetaReportBucket {
  return { latestEventAt: null, tasks: emptyTasks(), attempts: emptyAttempts(), deliveries: emptyDeliveries() };
}

function increment(target: Record<string, number>, key: string, count: number): void {
  target[key] = (target[key] ?? 0) + count;
}

function normalizeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

function addTaskRows(bucket: BetaReportBucket, rows: readonly BetaTaskStatusRow[]): void {
  for (const row of rows) {
    const count = normalizeCount(row.count);
    bucket.tasks.total += count;
    if (row.status === "succeeded") bucket.tasks.succeeded += count;
    else if (row.status === "failed") bucket.tasks.failed += count;
    else if (row.status === "expired") bucket.tasks.expired += count;
    else bucket.tasks.active += count;
  }
}

function addTaskFailures(bucket: BetaReportBucket, rows: readonly BetaTaskFailureRow[]): void {
  for (const row of rows) {
    const count = normalizeCount(row.count);
    increment(bucket.tasks.failureCounts, row.failureCode || "unknown", count);
  }
}

function addAttemptRows(bucket: BetaReportBucket, rows: readonly BetaAttemptRow[]): void {
  for (const row of rows) {
    const count = normalizeCount(row.count);
    bucket.attempts.total += count;
    if (row.status === "succeeded") bucket.attempts.succeeded += count;
    else {
      bucket.attempts.failed += count;
      if (row.failureCode) increment(bucket.attempts.failureCounts, row.failureCode, count);
    }
  }
  bucket.attempts.successRate = bucket.attempts.total === 0
    ? 0
    : Number((bucket.attempts.succeeded / bucket.attempts.total).toFixed(4));
}

function addDeliveryRows(bucket: BetaReportBucket, rows: readonly BetaDeliveryRow[]): void {
  for (const row of rows) {
    const count = normalizeCount(row.count);
    bucket.deliveries.total += count;
    if (row.resultClass === "succeeded" || row.resultClass === "passed" || row.resultClass === "redirect_issued") {
      bucket.deliveries.succeeded += count;
    } else {
      bucket.deliveries.failed += count;
    }
    increment(bucket.deliveries.resultCounts, row.resultClass, count);
  }
  bucket.deliveries.successRate = bucket.deliveries.total === 0
    ? 0
    : Number((bucket.deliveries.succeeded / bucket.deliveries.total).toFixed(4));
}

function latestDate(values: readonly (string | null)[]): string | null {
  const valid = values
    .filter((value): value is string => {
      if (!value) return false;
      return Number.isFinite(Date.parse(value));
    })
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return valid[0] ?? null;
}

function rowsForPlatform<T extends { platform: string }>(rows: readonly T[], platform: string): T[] {
  return rows.filter((row) => row.platform === platform);
}

function bucketFromRows(rows: BetaReportRows): BetaReportBucket {
  const bucket = emptyBucket();
  addTaskRows(bucket, rows.taskStatuses);
  addTaskFailures(bucket, rows.taskFailures);
  addAttemptRows(bucket, rows.attempts);
  addDeliveryRows(bucket, rows.deliveries);
  bucket.latestEventAt = latestDate([
    ...rows.taskStatuses.map((row) => row.latestAt),
    ...rows.attempts.map((row) => row.latestAt),
    ...rows.deliveries.map((row) => row.latestAt)
  ]);
  return bucket;
}

export function aggregateBetaHealth(
  rows: BetaReportRows,
  window: BetaReportWindow,
  platforms: readonly BetaPlatform[] = BETA_PLATFORMS,
  generatedAt = new Date().toISOString()
): BetaHealthReport {
  const selected = [...new Set(platforms)].filter((platform): platform is BetaPlatform => betaPlatforms.includes(platform));
  const scopedRows: BetaReportRows = {
    taskStatuses: rows.taskStatuses.filter((row) => selected.includes(row.platform as BetaPlatform)),
    taskFailures: rows.taskFailures.filter((row) => selected.includes(row.platform as BetaPlatform)),
    attempts: rows.attempts.filter((row) => selected.includes(row.platform as BetaPlatform)),
    deliveries: rows.deliveries.filter((row) => selected.includes(row.platform as BetaPlatform))
  };
  const totals = bucketFromRows(scopedRows);
  const byPlatform = Object.fromEntries(
    selected.map((platform) => [platform, bucketFromRows({
      taskStatuses: rowsForPlatform(rows.taskStatuses, platform),
      taskFailures: rowsForPlatform(rows.taskFailures, platform),
      attempts: rowsForPlatform(rows.attempts, platform),
      deliveries: rowsForPlatform(rows.deliveries, platform)
    })])
  ) as Record<BetaPlatform, BetaReportBucket>;
  const latestEventAt = latestDate([
    ...scopedRows.taskStatuses.map((row) => row.latestAt),
    ...scopedRows.attempts.map((row) => row.latestAt),
    ...scopedRows.deliveries.map((row) => row.latestAt)
  ]);
  return { generatedAt, window, platforms: selected, latestEventAt, totals, byPlatform };
}

interface TaskStatusQueryRow extends QueryResultRow {
  platform: string;
  status: TaskStatus;
  count: number;
  latest_at: Date | null;
}

interface TaskFailureQueryRow extends QueryResultRow {
  platform: string;
  failure_code: string | null;
  count: number;
}

interface AttemptQueryRow extends QueryResultRow {
  platform: string;
  status: "succeeded" | "failed";
  failure_code: string | null;
  count: number;
  latest_at: Date | null;
}

interface DeliveryQueryRow extends QueryResultRow {
  platform: string;
  result_class: string;
  count: number;
  latest_at: Date | null;
}

export class BetaOperabilityRepository {
  constructor(private readonly pool: Pool) {}

  async readRows(from: Date, to: Date, platforms: readonly BetaPlatform[] = BETA_PLATFORMS): Promise<BetaReportRows> {
    const selected = [...new Set(platforms)];
    const parameters = [from, to, selected];
    const [taskStatuses, taskFailures, attempts, deliveries] = await Promise.all([
      this.pool.query<TaskStatusQueryRow>(
        `SELECT platform, status, count(*)::int AS count, max(updated_at) AS latest_at
         FROM resolve_tasks
         WHERE observation_class = 'public' AND created_at >= $1 AND created_at < $2
           AND platform = ANY($3::text[])
         GROUP BY platform, status ORDER BY platform, status`, parameters),
      this.pool.query<TaskFailureQueryRow>(
        `SELECT platform, error->>'code' AS failure_code, count(*)::int AS count
         FROM resolve_tasks
         WHERE observation_class = 'public' AND status = 'failed'
           AND updated_at >= $1 AND updated_at < $2
           AND platform = ANY($3::text[])
         GROUP BY platform, error->>'code' ORDER BY platform, failure_code`, parameters),
      this.pool.query<AttemptQueryRow>(
        `SELECT pa.platform, pa.status, pa.failure_code, count(*)::int AS count,
           max(pa.finished_at) AS latest_at
         FROM provider_attempts pa
         JOIN resolve_tasks rt ON rt.id = pa.task_id
         WHERE rt.observation_class = 'public' AND pa.finished_at >= $1 AND pa.finished_at < $2
           AND pa.platform = ANY($3::text[])
         GROUP BY pa.platform, pa.status, pa.failure_code ORDER BY pa.platform, pa.status, pa.failure_code`, parameters),
      this.pool.query<DeliveryQueryRow>(
        `SELECT platform, result_class, count(*)::int AS count, max(occurred_at) AS latest_at
         FROM provider_delivery_outcomes
         WHERE observation_class = 'public' AND occurred_at >= $1 AND occurred_at < $2
           AND platform = ANY($3::text[])
         GROUP BY platform, result_class ORDER BY platform, result_class`, parameters)
    ]);
    return {
      taskStatuses: taskStatuses.rows.map((row) => ({ platform: row.platform, status: row.status, count: row.count, latestAt: row.latest_at?.toISOString() ?? null })),
      taskFailures: taskFailures.rows.map((row) => ({ platform: row.platform, failureCode: row.failure_code, count: row.count })),
      attempts: attempts.rows.map((row) => ({ platform: row.platform, status: row.status, failureCode: row.failure_code, count: row.count, latestAt: row.latest_at?.toISOString() ?? null })),
      deliveries: deliveries.rows.map((row) => ({ platform: row.platform, resultClass: row.result_class, count: row.count, latestAt: row.latest_at?.toISOString() ?? null }))
    };
  }

  async report(options: { hours: number; platforms?: readonly BetaPlatform[]; now?: Date }): Promise<BetaHealthReport> {
    const now = options.now ?? new Date();
    const hours = options.hours;
    const from = new Date(now.getTime() - hours * 3_600_000);
    const platforms = options.platforms ?? BETA_PLATFORMS;
    const rows = await this.readRows(from, now, platforms);
    return aggregateBetaHealth(rows, { from: from.toISOString(), to: now.toISOString(), hours }, platforms, now.toISOString());
  }
}
