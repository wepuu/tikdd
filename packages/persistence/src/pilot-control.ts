import {
  PilotGuardSampleSummarySchema, PilotGuardSchema, PilotGuardSnapshotSchema,
  PilotPolicySchema, RolloutOperatorIdSchema,
  type PilotGuard, type PilotGuardSampleSummary, type PilotGuardSnapshot, type PilotPolicy
} from "@tikdd/rollout-control";
import type { Pool, QueryResultRow } from "pg";

interface GuardRow extends QueryResultRow {
  provider_id: string; platform: string; region: string; policy_id: string; policy_version: number;
  cap_bps: number; last_healthy_allocation_bps: number; action: PilotGuard["action"];
  reason_code: PilotGuard["reason"]; evidence_window_started_at: Date; evidence_window_ended_at: Date;
  revision: string; updated_at: Date; expires_at: Date;
}
function mapGuard(row: GuardRow): PilotGuard {
  return PilotGuardSchema.parse({ providerId: row.provider_id, platform: row.platform, region: row.region,
    policyId: row.policy_id, policyVersion: row.policy_version, capBps: row.cap_bps,
    lastHealthyAllocationBps: row.last_healthy_allocation_bps, action: row.action, reason: row.reason_code,
    evidenceWindowStartedAt: row.evidence_window_started_at.toISOString(), evidenceWindowEndedAt: row.evidence_window_ended_at.toISOString(),
    revision: Number(row.revision), updatedAt: row.updated_at.toISOString(), expiresAt: row.expires_at.toISOString() });
}
export class PilotGuardConflictError extends Error { constructor(message: string) { super(message); this.name = "PilotGuardConflictError"; } }

export class PilotControlRepository {
  constructor(private readonly pool: Pool) {}
  async lockPolicy(input: { policy: PilotPolicy; reviewerId: string }): Promise<void> {
    const policy = PilotPolicySchema.parse(input.policy);
    const reviewerId = RolloutOperatorIdSchema.parse(input.reviewerId);
    await this.pool.query(`INSERT INTO provider_pilot_policies (policy_id,version,provider_id,platform,region,policy,
      calibration_started_at,calibration_completed_at,locked_at,expires_at,reviewer_id)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)`,
      [policy.id,policy.version,policy.providerId,policy.platform,policy.region,JSON.stringify(policy),policy.calibrationStartedAt,
       policy.calibrationCompletedAt,policy.lockedAt,policy.expiresAt,reviewerId]);
  }
  async listActivePolicies(now = new Date()): Promise<PilotPolicy[]> {
    const result = await this.pool.query<{ policy: unknown }>(
      `SELECT policy FROM provider_pilot_policies
       WHERE locked_at<=$1 AND expires_at>$1
       ORDER BY provider_id,platform,region,version DESC`, [now]);
    return result.rows.map((row) => PilotPolicySchema.parse(row.policy));
  }
  async applyGuard(input: { guard: PilotGuard; expectedRevision: number | null; actorId: string; sampleSummary: PilotGuardSampleSummary; actorType?: "evaluator" | "operator"; operatorGrantAllocationBps?: number; expectedRolloutRevision?: number; verifyEvidenceRevisions?: boolean }): Promise<PilotGuard> {
    const guard = PilotGuardSchema.parse(input.guard);
    const actorId = RolloutOperatorIdSchema.parse(input.actorId);
    const summary = PilotGuardSampleSummarySchema.parse(input.sampleSummary);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query<GuardRow>(`SELECT provider_id,platform,region,policy_id,policy_version,cap_bps,
        last_healthy_allocation_bps,action,reason_code,evidence_window_started_at,evidence_window_ended_at,
        revision::text,updated_at,expires_at FROM provider_pilot_guards
        WHERE provider_id=$1 AND platform=$2 AND region=$3 FOR UPDATE`, [guard.providerId,guard.platform,guard.region]);
      const previous = selected.rows[0] ? mapGuard(selected.rows[0]) : null;
      if ((previous?.revision ?? null) !== input.expectedRevision) throw new PilotGuardConflictError("Pilot guard revision changed before evaluation was persisted.");
      const actorType = input.actorType ?? "evaluator";
      if(actorType==="evaluator"&&input.expectedRolloutRevision!==undefined){const rollout=await client.query<{revision:string}>(`SELECT COALESCE(MAX(id),0)::text AS revision FROM provider_rollout_rule_audit`);if(Number(rollout.rows[0]?.revision??0)!==input.expectedRolloutRevision)throw new PilotGuardConflictError("Rollout authorization changed before evaluation was persisted.");}
      if(actorType==="evaluator"&&input.verifyEvidenceRevisions===true){const evidence=await client.query<{revision:string}>(`SELECT aggregate_revision::text AS revision FROM provider_daily_evidence
        WHERE provider_id=$1 AND platform=$2 AND region=$3 AND observation_class=$4
          AND aggregation_version=$5 AND taxonomy_version=$6
          AND utc_day >= $7::timestamptz::date AND utc_day < $8::timestamptz::date AND expires_at>NOW()
        ORDER BY utc_day`,[guard.providerId,guard.platform,guard.region,summary.observationClass,
          summary.aggregationVersion,summary.taxonomyVersion,guard.evidenceWindowStartedAt,guard.evidenceWindowEndedAt]);
        if(evidence.rows.map((row)=>Number(row.revision)).join(",")!==summary.dayRevisions.join(","))throw new PilotGuardConflictError("Evidence revisions changed before evaluation was persisted.");}
      if (previous && guard.capBps > previous.capBps && actorType !== "operator") throw new PilotGuardConflictError("Automation cannot raise a pilot guard cap.");
      if (actorType === "operator" && (!Number.isInteger(input.operatorGrantAllocationBps) || guard.capBps > (input.operatorGrantAllocationBps ?? -1))) {
        throw new PilotGuardConflictError("An operator guard cannot exceed the existing operator grant.");
      }
      if (guard.revision !== (previous?.revision ?? 0) + 1) throw new PilotGuardConflictError("Pilot guard revision is not the next revision.");
      const persisted = await client.query<GuardRow>(`INSERT INTO provider_pilot_guards (provider_id,platform,region,policy_id,
        policy_version,cap_bps,last_healthy_allocation_bps,action,reason_code,evidence_window_started_at,evidence_window_ended_at,
        revision,updated_at,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (provider_id,platform,region) DO UPDATE SET policy_id=EXCLUDED.policy_id,policy_version=EXCLUDED.policy_version,
        cap_bps=EXCLUDED.cap_bps,last_healthy_allocation_bps=EXCLUDED.last_healthy_allocation_bps,action=EXCLUDED.action,
        reason_code=EXCLUDED.reason_code,evidence_window_started_at=EXCLUDED.evidence_window_started_at,
        evidence_window_ended_at=EXCLUDED.evidence_window_ended_at,revision=EXCLUDED.revision,updated_at=EXCLUDED.updated_at,expires_at=EXCLUDED.expires_at
        RETURNING provider_id,platform,region,policy_id,policy_version,cap_bps,last_healthy_allocation_bps,action,reason_code,
        evidence_window_started_at,evidence_window_ended_at,revision::text,updated_at,expires_at`,
        [guard.providerId,guard.platform,guard.region,guard.policyId,guard.policyVersion,guard.capBps,guard.lastHealthyAllocationBps,
         guard.action,guard.reason,guard.evidenceWindowStartedAt,guard.evidenceWindowEndedAt,guard.revision,guard.updatedAt,guard.expiresAt]);
      await client.query(`INSERT INTO provider_pilot_guard_audit (provider_id,platform,region,policy_id,policy_version,
        previous_cap_bps,new_cap_bps,action,reason_code,evidence_window_started_at,evidence_window_ended_at,sample_summary,actor_type,actor_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)`,
        [guard.providerId,guard.platform,guard.region,guard.policyId,guard.policyVersion,previous?.capBps ?? null,guard.capBps,
         guard.action,guard.reason,guard.evidenceWindowStartedAt,guard.evidenceWindowEndedAt,JSON.stringify(summary),actorType,actorId]);
      await client.query("COMMIT"); return mapGuard(persisted.rows[0] as GuardRow);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async loadGuardSnapshot(): Promise<PilotGuardSnapshot> {
    const [guards, meta] = await Promise.all([
      this.pool.query<GuardRow>(`SELECT provider_id,platform,region,policy_id,policy_version,cap_bps,last_healthy_allocation_bps,
        action,reason_code,evidence_window_started_at,evidence_window_ended_at,revision::text,updated_at,expires_at
        FROM provider_pilot_guards ORDER BY provider_id,platform,region`),
      this.pool.query<{ revision: string; database_now: Date }>(`SELECT COALESCE(MAX(id),0)::text AS revision,NOW() AS database_now FROM provider_pilot_guard_audit`)
    ]);
    return PilotGuardSnapshotSchema.parse({ schemaVersion: "1", revision: Number(meta.rows[0]?.revision ?? 0),
      generatedAt: (meta.rows[0]?.database_now ?? new Date()).toISOString(), guards: guards.rows.map(mapGuard) });
  }
}
