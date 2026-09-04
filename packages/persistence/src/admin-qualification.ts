import {
  AdminMutationReceiptSchema,
  type AdminMutationReceipt,
  type AdminQualificationLockCommand,
  type AdminQualificationReviewCommand,
  type AdminQualificationStage
} from "@tikdd/admin-contracts";
import { PilotDailyEvidenceSchema, PilotPolicySchema, type PilotDailyEvidence, type PilotPolicy } from "@tikdd/rollout-control";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import { randomUUID } from "node:crypto";

export interface QualificationCommandIdentity {
  commandId: string;
  idempotencyDigest: Buffer;
  commandDigest: Buffer;
  actorSubject: string;
  expiresAt: Date;
}

export interface QualificationRecord {
  stage: AdminQualificationStage;
  paused: boolean;
  pauseReason: string | null;
  approvalReference: string | null;
  policyId: string | null;
  policyVersion: number | null;
  reviewer: string;
  revision: number;
  reviewedAt: string;
}

export interface CalibrationProposalRecord {
  proposalId: string;
  status: "proposed" | "locked" | "rejected" | "superseded";
  revision: number;
  evidenceOwner: string;
  dayRevisions: number[];
  policy: PilotPolicy;
  createdAt: string;
  updatedAt: string;
}

export interface QualificationAdminState {
  qualification: QualificationRecord | null;
  evidenceDays: PilotDailyEvidence[];
  proposal: CalibrationProposalRecord | null;
  lockedPolicy: PilotPolicy | null;
  guard: { action: "hold" | "reduce" | "deny" | "eligible_for_review"; reason: string; capBps: number; revision: number; updatedAt: string; expiresAt: string } | null;
  rollout: { allocationBps: number; revision: number | null };
  canary: { succeeded: boolean; observedAt: string } | null;
  databaseNow: string;
}

interface ReceiptRow extends QueryResultRow {
  command_id: string; command_digest: Buffer; aggregate_kind: "qualification"; target_id: string;
  expected_revision: string | null; accepted_revision: string | null; current_revision: string | null;
  propagated_revision: string | null; state: AdminMutationReceipt["state"]; created_at: Date; completed_at: Date | null;
}

export class AdminQualificationConflictError extends Error {
  constructor(message = "Qualification state changed before the command was applied.") { super(message); this.name = "AdminQualificationConflictError"; }
}
export class AdminQualificationIdempotencyConflictError extends Error {
  constructor() { super("The idempotency key was already used for different qualification input."); this.name = "AdminQualificationIdempotencyConflictError"; }
}

function receipt(row: ReceiptRow): AdminMutationReceipt {
  return AdminMutationReceiptSchema.parse({ schemaVersion: "1", commandId: row.command_id, aggregate: row.aggregate_kind,
    targetId: row.target_id, expectedRevision: row.expected_revision === null ? null : Number(row.expected_revision),
    acceptedRevision: row.accepted_revision === null ? null : Number(row.accepted_revision),
    currentRevision: row.current_revision === null ? null : Number(row.current_revision),
    propagatedRevision: row.propagated_revision === null ? null : Number(row.propagated_revision), state: row.state,
    acceptedAt: row.created_at.toISOString(), completedAt: row.completed_at?.toISOString() ?? null });
}

async function replay(client: PoolClient, identity: QualificationCommandIdentity): Promise<AdminMutationReceipt | null> {
  const result = await client.query<ReceiptRow>(`SELECT command_id,command_digest,aggregate_kind,target_id,expected_revision::text,
    accepted_revision::text,current_revision::text,propagated_revision::text,state,created_at,completed_at
    FROM admin_command_receipts WHERE idempotency_digest=$1 AND expires_at>NOW() FOR UPDATE`, [identity.idempotencyDigest]);
  const row = result.rows[0];
  if (!row) return null;
  if (!row.command_digest.equals(identity.commandDigest)) throw new AdminQualificationIdempotencyConflictError();
  return receipt(row);
}

async function writeReceipt(client: PoolClient, identity: QualificationCommandIdentity, targetId: string,
  expectedRevision: number | null, acceptedRevision: number): Promise<AdminMutationReceipt> {
  const result = await client.query<ReceiptRow>(`INSERT INTO admin_command_receipts
    (command_id,idempotency_digest,command_digest,aggregate_kind,target_id,actor_subject,expected_revision,
     accepted_revision,current_revision,propagated_revision,state,completed_at,expires_at)
    VALUES($1,$2,$3,'qualification',$4,$5,$6,$7,$7,$7,'propagated',NOW(),$8)
    RETURNING command_id,command_digest,aggregate_kind,target_id,expected_revision::text,accepted_revision::text,
      current_revision::text,propagated_revision::text,state,created_at,completed_at`,
    [identity.commandId,identity.idempotencyDigest,identity.commandDigest,targetId,identity.actorSubject,expectedRevision,acceptedRevision,identity.expiresAt]);
  return receipt(result.rows[0] as ReceiptRow);
}

function tuple(command: {providerId:string;platform:string;region:string}): string[] { return [command.providerId,command.platform,command.region]; }

export class AdminQualificationRepository {
  constructor(private readonly pool: Pool) {}

  async getState(providerId: string, platform: string, region: string): Promise<QualificationAdminState> {
    const [qualification,evidence,proposal,policy,guard,rollout,canary,clock] = await Promise.all([
      this.pool.query<QueryResultRow>(`SELECT stage,paused,pause_reason,approval_reference,policy_id,policy_version,
        reviewer_id,revision::text,reviewed_at FROM provider_qualification_reviews
        WHERE provider_id=$1 AND platform=$2 AND region=$3`,[providerId,platform,region]),
      this.pool.query<{summary:unknown} & QueryResultRow>(`SELECT summary FROM provider_daily_evidence
        WHERE provider_id=$1 AND platform=$2 AND region=$3 AND observation_class='internal' AND expires_at>NOW()
        ORDER BY utc_day DESC,aggregation_version DESC,taxonomy_version DESC LIMIT 3`,[providerId,platform,region]),
      this.pool.query<QueryResultRow>(`SELECT proposal_id::text,status,revision::text,evidence_owner_id,day_revisions,
        proposed_policy,created_at,updated_at FROM provider_calibration_proposals
        WHERE provider_id=$1 AND platform=$2 AND region=$3 AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1`,[providerId,platform,region]),
      this.pool.query<{policy:unknown} & QueryResultRow>(`SELECT policy FROM provider_pilot_policies
        WHERE provider_id=$1 AND platform=$2 AND region=$3 ORDER BY version DESC LIMIT 1`,[providerId,platform,region]),
      this.pool.query<QueryResultRow>(`SELECT action,reason_code,cap_bps,revision::text,updated_at,expires_at
        FROM provider_pilot_guards WHERE provider_id=$1 AND platform=$2 AND region=$3`,[providerId,platform,region]),
      this.pool.query<QueryResultRow>(`SELECT rule_id,provider_id,platform,region,enabled,allocation_bps,revision::text FROM provider_rollout_rules
        WHERE provider_id IN ($1,'*') AND platform IN ($2,'*') AND region IN ($3,'*')
          AND activates_at<=NOW() AND (expires_at IS NULL OR expires_at>NOW())`,[providerId,platform,region]),
      this.pool.query<QueryResultRow>(`SELECT status,recorded_at FROM provider_canary_measurements
        WHERE provider_id=$1 AND platform=$2 AND region=$3 AND expires_at>NOW() ORDER BY recorded_at DESC LIMIT 1`,[providerId,platform,region]),
      this.pool.query<{database_now:Date} & QueryResultRow>("SELECT NOW() AS database_now")
    ]);
    const q=qualification.rows[0]; const p=proposal.rows[0]; const g=guard.rows[0]; const c=canary.rows[0];
    const specificity=(item:QueryResultRow)=>Number(item.provider_id!=="*")+Number(item.platform!=="*")+Number(item.region!=="*");
    const deny=rollout.rows.filter(item=>!item.enabled).sort((left,right)=>specificity(right)-specificity(left)||String(left.rule_id).localeCompare(String(right.rule_id)))[0];
    const grant=rollout.rows.filter(item=>item.enabled).sort((left,right)=>specificity(right)-specificity(left)||String(left.rule_id).localeCompare(String(right.rule_id)))[0];
    const effectiveRule=deny??grant;
    return {
      qualification:q?{stage:q.stage as AdminQualificationStage,paused:Boolean(q.paused),pauseReason:q.pause_reason as string|null,
        approvalReference:q.approval_reference as string|null,policyId:q.policy_id as string|null,policyVersion:q.policy_version===null?null:Number(q.policy_version),
        reviewer:String(q.reviewer_id),revision:Number(q.revision),reviewedAt:(q.reviewed_at as Date).toISOString()}:null,
      evidenceDays:evidence.rows.map(row=>PilotDailyEvidenceSchema.parse(row.summary)).reverse(),
      proposal:p?{proposalId:String(p.proposal_id),status:p.status as CalibrationProposalRecord["status"],revision:Number(p.revision),
        evidenceOwner:String(p.evidence_owner_id),dayRevisions:p.day_revisions as number[],policy:PilotPolicySchema.parse(p.proposed_policy),
        createdAt:(p.created_at as Date).toISOString(),updatedAt:(p.updated_at as Date).toISOString()}:null,
      lockedPolicy:policy.rows[0]?PilotPolicySchema.parse(policy.rows[0].policy):null,
      guard:g?{action:g.action as "hold"|"reduce"|"deny"|"eligible_for_review",
        reason:String(g.reason_code),capBps:Number(g.cap_bps),revision:Number(g.revision),updatedAt:(g.updated_at as Date).toISOString(),expiresAt:(g.expires_at as Date).toISOString()}:null,
      rollout:effectiveRule?{allocationBps:deny?0:Number(effectiveRule.allocation_bps),revision:Number(effectiveRule.revision)}:{allocationBps:0,revision:null},
      canary:c?{succeeded:c.status==="succeeded",observedAt:(c.recorded_at as Date).toISOString()}:null,
      databaseNow:(clock.rows[0]?.database_now??new Date()).toISOString()
    };
  }

  async review(command: AdminQualificationReviewCommand, identity: QualificationCommandIdentity): Promise<AdminMutationReceipt> {
    const client=await this.pool.connect();
    try { await client.query("BEGIN"); const existing=await replay(client,identity); if(existing){await client.query("COMMIT");return existing;}
      const selected=await client.query<QueryResultRow>(`SELECT stage,paused,revision::text,policy_id,policy_version FROM provider_qualification_reviews
        WHERE provider_id=$1 AND platform=$2 AND region=$3 FOR UPDATE`,tuple(command)); const previous=selected.rows[0];
      const current=previous?Number(previous.revision):null; if(current!==command.expectedRevision)throw new AdminQualificationConflictError();
      const next=(current??0)+1; const paused=command.decision!=="approve"; const previousStage=previous?String(previous.stage):null;
      if(paused&&previousStage!==null&&command.targetStage!==previousStage)throw new AdminQualificationConflictError("Hold and deny cannot advance qualification.");
      await client.query(`INSERT INTO provider_qualification_reviews
        (provider_id,platform,region,stage,paused,pause_reason,approval_reference,policy_id,policy_version,reviewer_id,owner_id,revision,reviewed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,NOW())
        ON CONFLICT(provider_id,platform,region) DO UPDATE SET stage=$4,paused=$5,pause_reason=$6,approval_reference=$7,
          reviewer_id=$10,owner_id=$10,revision=$11,reviewed_at=NOW(),updated_at=NOW()`,
        [command.providerId,command.platform,command.region,command.targetStage,paused,paused?command.reason:null,command.approvalReference,
         previous?.policy_id??null,previous?.policy_version??null,identity.actorSubject,next]);
      const bounds=await client.query<QueryResultRow>(`SELECT MIN(utc_day)::timestamptz AS started,MAX(utc_day + 1)::timestamptz AS ended,
        COALESCE(SUM((summary->>'distinctResolutionTasks')::int),0)::int AS samples FROM provider_daily_evidence
        WHERE provider_id=$1 AND platform=$2 AND region=$3 AND observation_class='internal'`,tuple(command));
      const now=new Date();const started=bounds.rows[0]?.started as Date|null;const ended=bounds.rows[0]?.ended as Date|null;
      await client.query(`INSERT INTO provider_qualification_review_audit
        (provider_id,platform,region,previous_stage,new_stage,previous_allocation_bps,requested_allocation_bps,
         approval_reference,policy_id,policy_version,evidence_window_started_at,evidence_window_ended_at,sample_sufficient,actor_id,reason,expires_at)
        VALUES($1,$2,$3,$4,$5,NULL,0,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [command.providerId,command.platform,command.region,previousStage,command.targetStage,command.approvalReference,
         previous?.policy_id??null,previous?.policy_version??null,started??new Date(now.getTime()-1),ended??now,
         Number(bounds.rows[0]?.samples??0)>0,identity.actorSubject,command.reason,new Date(now.getTime()+400*86_400_000)]);
      const result=await writeReceipt(client,identity,`${command.providerId}/${command.platform}/${command.region}`,command.expectedRevision,next);
      await client.query("COMMIT");return result;
    } catch(error){await client.query("ROLLBACK");throw error;} finally{client.release();}
  }

  async lockPolicy(command: AdminQualificationLockCommand, identity: QualificationCommandIdentity): Promise<AdminMutationReceipt> {
    const client=await this.pool.connect();
    try { await client.query("BEGIN");const existing=await replay(client,identity);if(existing){await client.query("COMMIT");return existing;}
      const currentRow=await client.query<QueryResultRow>(`SELECT stage,revision::text FROM provider_qualification_reviews
        WHERE provider_id=$1 AND platform=$2 AND region=$3 FOR UPDATE`,tuple(command));const current=currentRow.rows[0]?Number(currentRow.rows[0].revision):null;
      if(current!==command.expectedRevision)throw new AdminQualificationConflictError();
      const selected=await client.query<QueryResultRow>(`SELECT proposed_policy,day_revisions,revision::text,expires_at FROM provider_calibration_proposals
        WHERE proposal_id=$1 AND provider_id=$2 AND platform=$3 AND region=$4 AND status='proposed' FOR UPDATE`,
        [command.proposalId,command.providerId,command.platform,command.region]);const row=selected.rows[0];
      if(!row||Number(row.revision)!==command.expectedProposalRevision)throw new AdminQualificationConflictError("Calibration proposal changed before policy lock.");
      const policy=PilotPolicySchema.parse(row.proposed_policy);const evidence=await client.query<QueryResultRow>(`SELECT aggregate_revision::text,completeness FROM provider_daily_evidence
        WHERE provider_id=$1 AND platform=$2 AND region=$3 AND observation_class='internal'
          AND utc_day>=$4::timestamptz::date AND utc_day<$5::timestamptz::date AND expires_at>NOW() ORDER BY utc_day`,
        [command.providerId,command.platform,command.region,policy.calibrationStartedAt,policy.calibrationCompletedAt]);
      if(evidence.rows.length!==3||evidence.rows.some(item=>item.completeness!=="sealed")||
        evidence.rows.map(item=>Number(item.aggregate_revision)).join(",")!==policy.calibrationDayRevisions.join(","))
        throw new AdminQualificationConflictError("The proposal evidence is no longer the exact three sealed revisions.");
      await client.query(`INSERT INTO provider_pilot_policies (policy_id,version,provider_id,platform,region,policy,
        calibration_started_at,calibration_completed_at,locked_at,expires_at,reviewer_id)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)`,[policy.id,policy.version,policy.providerId,policy.platform,policy.region,
        JSON.stringify(policy),policy.calibrationStartedAt,policy.calibrationCompletedAt,policy.lockedAt,policy.expiresAt,identity.actorSubject]);
      await client.query(`UPDATE provider_calibration_proposals SET status='locked',revision=revision+1,updated_at=NOW() WHERE proposal_id=$1`,[command.proposalId]);
      await client.query(`INSERT INTO provider_evidence_reviews (review_id,proposal_id,provider_id,platform,region,action,policy_id,
        policy_version,evidence_window_started_at,evidence_window_ended_at,day_revisions,reviewer_id,revision,expires_at)
        VALUES($1,$2,$3,$4,$5,'lock_policy',$6,$7,$8,$9,$10::jsonb,$11,1,$12)`,[randomUUID(),command.proposalId,command.providerId,
        command.platform,command.region,policy.id,policy.version,policy.calibrationStartedAt,policy.calibrationCompletedAt,
        JSON.stringify(policy.calibrationDayRevisions),identity.actorSubject,row.expires_at]);
      const next=(current??0)+1;const stage=currentRow.rows[0]?.stage??"internal";
      await client.query(`INSERT INTO provider_qualification_reviews
        (provider_id,platform,region,stage,paused,pause_reason,approval_reference,policy_id,policy_version,reviewer_id,owner_id,revision,reviewed_at)
        VALUES($1,$2,$3,$4,TRUE,$5,NULL,$6,$7,$8,$8,$9,NOW()) ON CONFLICT(provider_id,platform,region) DO UPDATE SET
        policy_id=$6,policy_version=$7,reviewer_id=$8,revision=$9,reviewed_at=NOW(),updated_at=NOW()`,[command.providerId,command.platform,
        command.region,stage,"Policy locked; explicit qualification approval is still required.",policy.id,policy.version,identity.actorSubject,next]);
      const result=await writeReceipt(client,identity,`${command.providerId}/${command.platform}/${command.region}`,command.expectedRevision,next);
      await client.query("COMMIT");return result;
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }
}
