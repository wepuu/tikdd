import { type Pool, type PoolClient, type QueryResultRow } from "pg";

export const cleanupStages = [
  "deliveryTickets",
  "deliveryCandidates",
  "idempotencyRecords",
  "activeSourceAdmissions",
  "expiredTasks",
  "hardDeletedTasks"
] as const;

export type CleanupStage = (typeof cleanupStages)[number];
export type CleanupCounts = Record<CleanupStage, number>;

export interface CleanupPolicy {
  batchSize: number;
  taskHardRetentionMs: number;
  statementTimeoutMs: number;
}

interface CountRow extends QueryResultRow {
  delivery_tickets: string;
  delivery_candidates: string;
  idempotency_records: string;
  active_source_admissions: string;
  expired_tasks: string;
  hard_deleted_tasks: string;
}

interface MutationRow extends QueryResultRow {
  affected: number;
}

const stageQueries: Record<CleanupStage, string> = {
  deliveryTickets: `
    WITH selected AS (
      SELECT id FROM delivery_tickets
      WHERE expires_at <= NOW()
      ORDER BY expires_at, id
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM delivery_tickets target
      USING selected
      WHERE target.id = selected.id
      RETURNING target.id
    )
    SELECT count(*)::int AS affected FROM removed`,
  deliveryCandidates: `
    WITH selected AS (
      SELECT id FROM delivery_candidates
      WHERE expires_at <= NOW()
      ORDER BY expires_at, id
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM delivery_candidates target
      USING selected
      WHERE target.id = selected.id
      RETURNING target.id
    )
    SELECT count(*)::int AS affected FROM removed`,
  idempotencyRecords: `
    WITH selected AS (
      SELECT key_digest FROM resolve_task_idempotency
      WHERE expires_at <= NOW()
      ORDER BY expires_at, key_digest
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM resolve_task_idempotency target
      USING selected
      WHERE target.key_digest = selected.key_digest
      RETURNING target.key_digest
    )
    SELECT count(*)::int AS affected FROM removed`,
  activeSourceAdmissions: `
    WITH selected AS (
      SELECT source_fingerprint FROM active_source_admissions
      WHERE expires_at <= NOW()
      ORDER BY expires_at, source_fingerprint
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM active_source_admissions target
      USING selected
      WHERE target.source_fingerprint = selected.source_fingerprint
      RETURNING target.source_fingerprint
    )
    SELECT count(*)::int AS affected FROM removed`,
  expiredTasks: `
    WITH selected AS (
      SELECT id FROM resolve_tasks
      WHERE expires_at <= NOW() AND status <> 'expired'
      ORDER BY expires_at, id
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    ), changed AS (
      UPDATE resolve_tasks target
      SET status = 'expired', updated_at = NOW()
      FROM selected
      WHERE target.id = selected.id
      RETURNING target.id
    )
    SELECT count(*)::int AS affected FROM changed`,
  hardDeletedTasks: `
    WITH selected AS (
      SELECT id FROM resolve_tasks
      WHERE expires_at <= NOW() - ($2::double precision * INTERVAL '1 millisecond')
      ORDER BY expires_at, id
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM resolve_tasks target
      USING selected
      WHERE target.id = selected.id
      RETURNING target.id
    )
    SELECT count(*)::int AS affected FROM removed`
};

function validatePolicy(policy: CleanupPolicy): void {
  if (!Number.isInteger(policy.batchSize) || policy.batchSize < 1 || policy.batchSize > 10_000) {
    throw new Error("Cleanup batch size is invalid.");
  }
  if (
    !Number.isInteger(policy.taskHardRetentionMs) ||
    policy.taskHardRetentionMs < 0 ||
    policy.taskHardRetentionMs > 365 * 24 * 60 * 60 * 1_000
  ) {
    throw new Error("Task hard-retention duration is invalid.");
  }
  if (
    !Number.isInteger(policy.statementTimeoutMs) ||
    policy.statementTimeoutMs < 100 ||
    policy.statementTimeoutMs > 60_000
  ) {
    throw new Error("Cleanup statement timeout is invalid.");
  }
}

async function setLocalStatementTimeout(client: PoolClient, timeoutMs: number): Promise<void> {
  await client.query("SELECT set_config('statement_timeout', $1, true)", [String(timeoutMs)]);
}

export function emptyCleanupCounts(): CleanupCounts {
  return {
    deliveryTickets: 0,
    deliveryCandidates: 0,
    idempotencyRecords: 0,
    activeSourceAdmissions: 0,
    expiredTasks: 0,
    hardDeletedTasks: 0
  };
}

export class CleanupRepository {
  constructor(private readonly pool: Pool) {}

  async countEligible(policy: CleanupPolicy): Promise<CleanupCounts> {
    validatePolicy(policy);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await setLocalStatementTimeout(client, policy.statementTimeoutMs);
      const result = await client.query<CountRow>(
        `SELECT
          (SELECT count(*) FROM delivery_tickets WHERE expires_at <= NOW())::text
            AS delivery_tickets,
          (SELECT count(*) FROM delivery_candidates WHERE expires_at <= NOW())::text
            AS delivery_candidates,
          (SELECT count(*) FROM resolve_task_idempotency WHERE expires_at <= NOW())::text
            AS idempotency_records,
          (SELECT count(*) FROM active_source_admissions WHERE expires_at <= NOW())::text
            AS active_source_admissions,
          (SELECT count(*) FROM resolve_tasks
            WHERE expires_at <= NOW() AND status <> 'expired')::text AS expired_tasks,
          (SELECT count(*) FROM resolve_tasks
            WHERE expires_at <= NOW() - ($1::double precision * INTERVAL '1 millisecond'))::text
            AS hard_deleted_tasks`,
        [policy.taskHardRetentionMs]
      );
      await client.query("COMMIT");
      const row = result.rows[0] as CountRow;
      return {
        deliveryTickets: Number(row.delivery_tickets),
        deliveryCandidates: Number(row.delivery_candidates),
        idempotencyRecords: Number(row.idempotency_records),
        activeSourceAdmissions: Number(row.active_source_admissions),
        expiredTasks: Number(row.expired_tasks),
        hardDeletedTasks: Number(row.hard_deleted_tasks)
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async processStage(stage: CleanupStage, policy: CleanupPolicy): Promise<number> {
    validatePolicy(policy);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await setLocalStatementTimeout(client, policy.statementTimeoutMs);
      const parameters =
        stage === "hardDeletedTasks"
          ? [policy.batchSize, policy.taskHardRetentionMs]
          : [policy.batchSize];
      const result = await client.query<MutationRow>(stageQueries[stage], parameters);
      await client.query("COMMIT");
      return Number(result.rows[0]?.affected ?? 0);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
