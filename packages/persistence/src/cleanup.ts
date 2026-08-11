import { type Pool, type PoolClient, type QueryResultRow } from "pg";

export const cleanupStages = [
  "deliveryTickets",
  "deliveryOutcomes",
  "deliveryCandidates",
  "canaryMeasurements",
  "dailyEvidence",
  "lateEvidence",
  "calibrationProposals",
  "evidenceReviews",
  "pilotGuardAudit",
  "qualificationReviewAudit",
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
  delivery_outcomes: string;
  delivery_candidates: string;
  canary_measurements: string;
  daily_evidence: string;
  late_evidence: string;
  calibration_proposals: string;
  evidence_reviews: string;
  pilot_guard_audit: string;
  qualification_review_audit: string;
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
      SELECT dt.id,dt.mode,dt.redeemed_at,dt.expiry_outcome_emitted,
        dc.provider_id,dc.platform,dc.region,dc.observation_class
      FROM delivery_tickets dt JOIN delivery_candidates dc ON dc.id=dt.candidate_id
      WHERE dt.expires_at <= NOW()
      ORDER BY dt.expires_at,dt.id
      LIMIT $1
      FOR UPDATE OF dt SKIP LOCKED
    ), outcomes AS (
      INSERT INTO provider_delivery_outcomes
      (outcome_id,provider_id,platform,region,observation_class,mode,stage,result_class,duration_ms,
       delivery_policy_version,taxonomy_version,occurred_at,expires_at)
      SELECT gen_random_uuid(),provider_id,platform,region,observation_class,mode,
       'ticket_expiry','expired_unredeemed',0,1,1,NOW(),NOW()+INTERVAL '35 days'
      FROM selected WHERE redeemed_at IS NULL AND expiry_outcome_emitted=FALSE
      RETURNING outcome_id
    ), removed AS (
      DELETE FROM delivery_tickets target
      USING selected
      WHERE target.id = selected.id
      RETURNING target.id
    )
    SELECT count(*)::int AS affected FROM removed`,
  deliveryOutcomes: `
    WITH selected AS (
      SELECT outcome_id FROM provider_delivery_outcomes WHERE expires_at<=NOW()
      ORDER BY expires_at,outcome_id LIMIT $1 FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM provider_delivery_outcomes target USING selected
      WHERE target.outcome_id=selected.outcome_id RETURNING target.outcome_id
    ) SELECT count(*)::int AS affected FROM removed`,
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
  canaryMeasurements: `
    WITH selected AS (
      SELECT id FROM provider_canary_measurements
      WHERE expires_at <= NOW()
      ORDER BY expires_at, id
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM provider_canary_measurements target
      USING selected
      WHERE target.id = selected.id
      RETURNING target.id
    )
    SELECT count(*)::int AS affected FROM removed`,
  dailyEvidence: `
    WITH selected AS (
      SELECT provider_id,platform,region,observation_class,utc_day,aggregation_version,taxonomy_version
      FROM provider_daily_evidence WHERE expires_at<=NOW()
      ORDER BY expires_at,provider_id,platform,region,observation_class,utc_day
      LIMIT $1 FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM provider_daily_evidence target USING selected
      WHERE target.provider_id=selected.provider_id AND target.platform=selected.platform
        AND target.region=selected.region AND target.observation_class=selected.observation_class
        AND target.utc_day=selected.utc_day AND target.aggregation_version=selected.aggregation_version
        AND target.taxonomy_version=selected.taxonomy_version
      RETURNING target.provider_id
    ) SELECT count(*)::int AS affected FROM removed`,
  lateEvidence: `
    WITH selected AS (
      SELECT provider_id,platform,region,observation_class,source_utc_day,aggregation_version,taxonomy_version
      FROM provider_late_evidence_counts WHERE expires_at<=NOW()
      ORDER BY expires_at,provider_id,platform,region,source_utc_day LIMIT $1 FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM provider_late_evidence_counts target USING selected
      WHERE target.provider_id=selected.provider_id AND target.platform=selected.platform
        AND target.region=selected.region AND target.observation_class=selected.observation_class
        AND target.source_utc_day=selected.source_utc_day AND target.aggregation_version=selected.aggregation_version
        AND target.taxonomy_version=selected.taxonomy_version RETURNING target.provider_id
    ) SELECT count(*)::int AS affected FROM removed`,
  calibrationProposals: `
    WITH selected AS (
      SELECT proposal_id FROM provider_calibration_proposals WHERE expires_at<=NOW()
      ORDER BY expires_at,proposal_id LIMIT $1 FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM provider_calibration_proposals target USING selected
      WHERE target.proposal_id=selected.proposal_id RETURNING target.proposal_id
    ) SELECT count(*)::int AS affected FROM removed`,
  evidenceReviews: `
    WITH selected AS (
      SELECT review_id FROM provider_evidence_reviews WHERE expires_at<=NOW()
      ORDER BY expires_at,review_id LIMIT $1 FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM provider_evidence_reviews target USING selected
      WHERE target.review_id=selected.review_id RETURNING target.review_id
    ) SELECT count(*)::int AS affected FROM removed`,
  pilotGuardAudit: `
    WITH selected AS (
      SELECT id FROM provider_pilot_guard_audit WHERE expires_at<=NOW()
      ORDER BY expires_at,id LIMIT $1 FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM provider_pilot_guard_audit target USING selected
      WHERE target.id=selected.id RETURNING target.id
    ) SELECT count(*)::int AS affected FROM removed`,
  qualificationReviewAudit: `
    WITH selected AS (
      SELECT id FROM provider_qualification_review_audit WHERE expires_at<=NOW()
      ORDER BY expires_at,id LIMIT $1 FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM provider_qualification_review_audit target USING selected
      WHERE target.id=selected.id RETURNING target.id
    ) SELECT count(*)::int AS affected FROM removed`,
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
    deliveryOutcomes: 0,
    deliveryCandidates: 0,
    canaryMeasurements: 0,
    dailyEvidence: 0,
    lateEvidence: 0,
    calibrationProposals: 0,
    evidenceReviews: 0,
    pilotGuardAudit: 0,
    qualificationReviewAudit: 0,
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
          (SELECT count(*) FROM provider_delivery_outcomes WHERE expires_at<=NOW())::text
            AS delivery_outcomes,
          (SELECT count(*) FROM delivery_candidates WHERE expires_at <= NOW())::text
            AS delivery_candidates,
          (SELECT count(*) FROM provider_canary_measurements WHERE expires_at <= NOW())::text
            AS canary_measurements,
          (SELECT count(*) FROM provider_daily_evidence WHERE expires_at<=NOW())::text AS daily_evidence,
          (SELECT count(*) FROM provider_late_evidence_counts WHERE expires_at<=NOW())::text AS late_evidence,
          (SELECT count(*) FROM provider_calibration_proposals WHERE expires_at<=NOW())::text AS calibration_proposals,
          (SELECT count(*) FROM provider_evidence_reviews WHERE expires_at<=NOW())::text AS evidence_reviews,
          (SELECT count(*) FROM provider_pilot_guard_audit WHERE expires_at<=NOW())::text AS pilot_guard_audit,
          (SELECT count(*) FROM provider_qualification_review_audit WHERE expires_at<=NOW())::text AS qualification_review_audit,
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
        deliveryOutcomes: Number(row.delivery_outcomes),
        deliveryCandidates: Number(row.delivery_candidates),
        canaryMeasurements: Number(row.canary_measurements),
        dailyEvidence: Number(row.daily_evidence),
        lateEvidence: Number(row.late_evidence),
        calibrationProposals: Number(row.calibration_proposals),
        evidenceReviews: Number(row.evidence_reviews),
        pilotGuardAudit: Number(row.pilot_guard_audit),
        qualificationReviewAudit: Number(row.qualification_review_audit),
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
