import {
  AdminMutationReceiptSchema,
  AdminRoutePolicyRevisionSchema,
  type AdminMutationReceipt,
  type AdminRoutePolicyRevision
} from "@tikdd/admin-contracts";
import type { AdminRouteSafetyCommand, AdminRouteProbeCommand } from "@tikdd/admin-contracts";
import { RoutePolicySnapshotSchema, type RoutePolicySnapshot } from "@tikdd/route-policy";
import type { Pool, PoolClient, QueryResultRow } from "pg";

interface HeadRow extends QueryResultRow {
  policy_id: string;
  head_revision: string;
  draft_revision: string | null;
  published_revision: string | null;
}

interface PolicyRow extends QueryResultRow {
  policy_id: string; platform: string; region: string; revision: string;
  revision_kind: "draft" | "published" | "rollback"; previous_revision: string | null;
  ordered_provider_ids: unknown; rollout_rule_ids: unknown; staged_allocations: unknown;
  concurrency_caps: unknown; reason: string; actor_subject: string; created_at: Date;
}

interface ReceiptRow extends QueryResultRow {
  command_id: string; command_digest: Buffer; aggregate_kind: "route_policy";
  target_id: string; expected_revision: string | null; accepted_revision: string | null;
  current_revision: string | null; propagated_revision: string | null;
  state: AdminMutationReceipt["state"]; created_at: Date; completed_at: Date | null;
}

export class AdminRoutePolicyConflictError extends Error {
  constructor(message = "The route policy changed before the command was applied.") {
    super(message); this.name = "AdminRoutePolicyConflictError";
  }
}

export class AdminIdempotencyConflictError extends Error {
  constructor() { super("The idempotency key was already used for a different command."); this.name = "AdminIdempotencyConflictError"; }
}

function mapPolicy(row: PolicyRow): AdminRoutePolicyRevision {
  return AdminRoutePolicyRevisionSchema.parse({
    schemaVersion: "1", policyId: row.policy_id, platform: row.platform, region: row.region,
    revision: Number(row.revision), revisionKind: row.revision_kind,
    previousRevision: row.previous_revision === null ? null : Number(row.previous_revision),
    orderedProviderIds: row.ordered_provider_ids, rolloutRuleIds: row.rollout_rule_ids,
    stagedAllocations: row.staged_allocations, concurrencyCaps: row.concurrency_caps,
    reason: row.reason, actorSubject: row.actor_subject, createdAt: row.created_at.toISOString()
  });
}

function mapReceipt(row: ReceiptRow): AdminMutationReceipt {
  return AdminMutationReceiptSchema.parse({
    schemaVersion: "1", commandId: row.command_id, aggregate: row.aggregate_kind,
    targetId: row.target_id, expectedRevision: row.expected_revision === null ? null : Number(row.expected_revision),
    acceptedRevision: row.accepted_revision === null ? null : Number(row.accepted_revision),
    currentRevision: row.current_revision === null ? null : Number(row.current_revision),
    propagatedRevision: row.propagated_revision === null ? null : Number(row.propagated_revision),
    state: row.state, acceptedAt: row.created_at.toISOString(), completedAt: row.completed_at?.toISOString() ?? null
  });
}

export interface RoutePolicyCommandIdentity {
  commandId: string;
  idempotencyDigest: Buffer;
  commandDigest: Buffer;
  actorSubject: string;
  expiresAt: Date;
}

export interface RoutePolicyDraftValues {
  platform: string; region: string; expectedRevision: number | null;
  orderedProviderIds: string[]; stagedAllocations: Array<{ providerId: string; allocationBps: number }>;
  concurrencyCaps: Array<{ providerId: string; limit: number }>;
  reason: string;
}

async function existingReceipt(client: PoolClient, identity: RoutePolicyCommandIdentity): Promise<AdminMutationReceipt | null> {
  const result = await client.query<ReceiptRow>(
    `SELECT command_id,command_digest,aggregate_kind,target_id,expected_revision::text,
       accepted_revision::text,current_revision::text,propagated_revision::text,state,created_at,completed_at
     FROM admin_command_receipts WHERE idempotency_digest=$1 AND expires_at>NOW() FOR UPDATE`,
    [identity.idempotencyDigest]
  );
  const row = result.rows[0];
  if (!row) return null;
  if (!row.command_digest.equals(identity.commandDigest)) throw new AdminIdempotencyConflictError();
  return mapReceipt(row);
}

async function lockedHead(client: PoolClient, platform: string, region: string): Promise<HeadRow | null> {
  const result = await client.query<HeadRow>(
    `SELECT policy_id,head_revision::text,draft_revision::text,published_revision::text
     FROM admin_route_policy_heads WHERE platform=$1 AND region=$2 FOR UPDATE`, [platform, region]
  );
  return result.rows[0] ?? null;
}

function requireExpected(head: HeadRow | null, expected: number | null): void {
  const actual = head ? Number(head.head_revision) : null;
  if (actual !== expected) throw new AdminRoutePolicyConflictError();
}

async function insertReceipt(client: PoolClient, input: {
  identity: RoutePolicyCommandIdentity; targetId: string; expectedRevision: number | null;
  acceptedRevision: number | null; currentRevision: number | null; propagatedRevision: number | null;
  state: AdminMutationReceipt["state"]; complete: boolean;
}): Promise<AdminMutationReceipt> {
  const result = await client.query<ReceiptRow>(
    `INSERT INTO admin_command_receipts
       (command_id,idempotency_digest,command_digest,aggregate_kind,target_id,actor_subject,
        expected_revision,accepted_revision,current_revision,propagated_revision,state,completed_at,expires_at)
     VALUES ($1,$2,$3,'route_policy',$4,$5,$6,$7,$8,$9,$10,CASE WHEN $11 THEN NOW() ELSE NULL END,$12)
     RETURNING command_id,command_digest,aggregate_kind,target_id,expected_revision::text,
       accepted_revision::text,current_revision::text,propagated_revision::text,state,created_at,completed_at`,
    [input.identity.commandId,input.identity.idempotencyDigest,input.identity.commandDigest,input.targetId,
      input.identity.actorSubject,input.expectedRevision,input.acceptedRevision,input.currentRevision,
      input.propagatedRevision,input.state,input.complete,input.identity.expiresAt]
  );
  return mapReceipt(result.rows[0] as ReceiptRow);
}

export class AdminRoutePolicyRepository {
  constructor(private readonly pool: Pool, private readonly deployment = "tikdd") {}

  async saveDraft(values: RoutePolicyDraftValues, identity: RoutePolicyCommandIdentity): Promise<AdminMutationReceipt> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const replay = await existingReceipt(client, identity); if (replay) { await client.query("COMMIT"); return replay; }
      const head = await lockedHead(client, values.platform, values.region); requireExpected(head, values.expectedRevision);
      const policyId = head?.policy_id ?? `rtp_${values.platform}_${values.region}`;
      const next = (head ? Number(head.head_revision) : 0) + 1;
      const rolloutRuleIds = values.stagedAllocations.map(({ providerId }) => `admin-${providerId}-${values.platform}-${values.region}`);
      await client.query(
        `INSERT INTO admin_route_policy_revisions
          (policy_id,platform,region,revision,revision_kind,previous_revision,ordered_provider_ids,
           rollout_rule_ids,staged_allocations,concurrency_caps,reason,actor_subject)
         VALUES ($1,$2,$3,$4,'draft',$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11)`,
        [policyId,values.platform,values.region,next,head?.published_revision ?? null,
          JSON.stringify(values.orderedProviderIds),JSON.stringify(rolloutRuleIds),JSON.stringify(values.stagedAllocations),
          JSON.stringify(values.concurrencyCaps),values.reason,identity.actorSubject]
      );
      await client.query(
        `INSERT INTO admin_route_policy_heads (policy_id,platform,region,head_revision,draft_revision,published_revision)
         VALUES ($1,$2,$3,$4,$4,NULL)
         ON CONFLICT (platform,region) DO UPDATE SET head_revision=$4,draft_revision=$4,updated_at=NOW()`,
        [policyId,values.platform,values.region,next]
      );
      const receipt = await insertReceipt(client,{identity,targetId:`${values.platform}/${values.region}`,
        expectedRevision:values.expectedRevision,acceptedRevision:next,currentRevision:next,propagatedRevision:null,
        state:"propagated",complete:true});
      await client.query("COMMIT"); return receipt;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async publish(input: { platform: string; region: string; expectedRevision: number; draftRevision: number; reason: string }, identity: RoutePolicyCommandIdentity): Promise<{ receipt: AdminMutationReceipt; projectionRevision: number }> {
    return this.promote({ ...input, sourceRevision: input.draftRevision, kind: "published" }, identity);
  }

  async rollback(input: { platform: string; region: string; expectedRevision: number; targetRevision: number; reason: string }, identity: RoutePolicyCommandIdentity): Promise<{ receipt: AdminMutationReceipt; projectionRevision: number }> {
    return this.promote({ ...input, sourceRevision: input.targetRevision, kind: "rollback" }, identity);
  }

  private async promote(input: { platform:string; region:string; expectedRevision:number; sourceRevision:number; reason:string; kind:"published"|"rollback" }, identity: RoutePolicyCommandIdentity): Promise<{ receipt: AdminMutationReceipt; projectionRevision: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const replay = await existingReceipt(client, identity);
      if (replay) {
        const projection=await client.query<{durable_revision:string}>(`SELECT durable_revision::text FROM admin_route_policy_projection_heads WHERE deployment=$1 AND region=$2`,[this.deployment,input.region]);
        await client.query("COMMIT");
        return { receipt: replay, projectionRevision: replay.propagatedRevision ?? Number(projection.rows[0]?.durable_revision ?? 0) };
      }
      const head = await lockedHead(client,input.platform,input.region); requireExpected(head,input.expectedRevision);
      if (!head) throw new AdminRoutePolicyConflictError();
      if (input.kind === "published" && Number(head.draft_revision) !== input.sourceRevision) throw new AdminRoutePolicyConflictError("The named draft is no longer current.");
      const source = await client.query<PolicyRow>(`SELECT * FROM admin_route_policy_revisions WHERE policy_id=$1 AND revision=$2 FOR SHARE`,[head.policy_id,input.sourceRevision]);
      const policy = source.rows[0] ? mapPolicy(source.rows[0]) : null;
      if (!policy || policy.platform !== input.platform || policy.region !== input.region || (input.kind === "rollback" && policy.revisionKind === "draft")) {
        throw new AdminRoutePolicyConflictError("The requested policy revision cannot be promoted.");
      }
      const next = Number(head.head_revision)+1;
      const previousPublished = head.published_revision === null ? null : Number(head.published_revision);
      await client.query(
        `INSERT INTO admin_route_policy_revisions
          (policy_id,platform,region,revision,revision_kind,previous_revision,ordered_provider_ids,
           rollout_rule_ids,staged_allocations,concurrency_caps,reason,actor_subject)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12)`,
        [head.policy_id,input.platform,input.region,next,input.kind,previousPublished,
          JSON.stringify(policy.orderedProviderIds),JSON.stringify(policy.rolloutRuleIds),JSON.stringify(policy.stagedAllocations),
          JSON.stringify(policy.concurrencyCaps),input.reason,identity.actorSubject]
      );
      await this.applyStagedAllocations(client,{...policy,revision:next,reason:input.reason,actorSubject:identity.actorSubject});
      await client.query(`UPDATE admin_route_policy_heads SET head_revision=$3,draft_revision=NULL,published_revision=$3,updated_at=NOW() WHERE platform=$1 AND region=$2`,[input.platform,input.region,next]);
      const projection = await client.query<{revision:string}>(`SELECT nextval('admin_route_policy_projection_revision_seq')::text AS revision`);
      const projectionRevision=Number(projection.rows[0]?.revision);
      await client.query(
        `INSERT INTO admin_route_policy_projection_heads (deployment,region,durable_revision,projected_revision,state)
         VALUES ($1,$2,$3,NULL,'propagating')
         ON CONFLICT (deployment,region) DO UPDATE SET durable_revision=$3,projected_revision=NULL,state='propagating',updated_at=NOW()`,
        [this.deployment,input.region,projectionRevision]
      );
      const receipt=await insertReceipt(client,{identity,targetId:`${input.platform}/${input.region}`,
        expectedRevision:input.expectedRevision,acceptedRevision:next,currentRevision:next,propagatedRevision:null,state:"propagating",complete:false});
      await client.query("COMMIT"); return {receipt,projectionRevision};
    } catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }

  private async applyStagedAllocations(client: PoolClient, policy: AdminRoutePolicyRevision): Promise<void> {
    for (const allocation of policy.stagedAllocations) {
      const ruleId=`admin-${allocation.providerId}-${policy.platform}-${policy.region}`;
      const existing=await client.query<{revision:string;before_rule:unknown}>(
        `SELECT revision::text,to_jsonb(provider_rollout_rules) AS before_rule FROM provider_rollout_rules WHERE rule_id=$1 FOR UPDATE`,[ruleId]);
      const previous=existing.rows[0]; const revision=Number(previous?.revision ?? 0)+1;
      const after={id:ruleId,providerId:allocation.providerId,platform:policy.platform,region:policy.region,
        enabled:allocation.allocationBps>0,allocationBps:allocation.allocationBps,revision,activatesAt:new Date().toISOString(),expiresAt:null};
      await client.query(
        `INSERT INTO provider_rollout_rules (rule_id,provider_id,platform,region,enabled,allocation_bps,revision,activates_at,expires_at,change_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NULL,$8)
         ON CONFLICT (rule_id) DO UPDATE SET enabled=$5,allocation_bps=$6,revision=$7,activates_at=NOW(),expires_at=NULL,change_reason=$8,updated_at=NOW()`,
        [ruleId,allocation.providerId,policy.platform,policy.region,allocation.allocationBps>0,allocation.allocationBps,revision,policy.reason]
      );
      await client.query(
        `INSERT INTO provider_rollout_rule_audit (rule_id,operator_id,reason,previous_revision,new_revision,before_rule,after_rule)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
        [ruleId,policy.actorSubject,policy.reason,previous ? Number(previous.revision):null,revision,
          previous ? JSON.stringify(previous.before_rule):null,JSON.stringify(after)]
      );
    }
  }

  async discard(input:{platform:string;region:string;expectedRevision:number;draftRevision:number},identity:RoutePolicyCommandIdentity):Promise<AdminMutationReceipt>{
    const client=await this.pool.connect();try{await client.query("BEGIN");const replay=await existingReceipt(client,identity);if(replay){await client.query("COMMIT");return replay;}
      const head=await lockedHead(client,input.platform,input.region);requireExpected(head,input.expectedRevision);
      if(!head||Number(head.draft_revision)!==input.draftRevision)throw new AdminRoutePolicyConflictError("The named draft is no longer current.");
      await client.query(`UPDATE admin_route_policy_heads SET draft_revision=NULL,updated_at=NOW() WHERE platform=$1 AND region=$2`,[input.platform,input.region]);
      const current=head.published_revision===null?null:Number(head.published_revision);
      const receipt=await insertReceipt(client,{identity,targetId:`${input.platform}/${input.region}`,expectedRevision:input.expectedRevision,
        acceptedRevision:null,currentRevision:current,propagatedRevision:null,state:"propagated",complete:true});await client.query("COMMIT");return receipt;
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}

  async loadRuntimeSnapshot(deployment:string,region:string):Promise<RoutePolicySnapshot>{
    const [projection,policies]=await Promise.all([
      this.pool.query<{durable_revision:string;database_now:Date}>(`SELECT durable_revision::text,NOW() AS database_now FROM admin_route_policy_projection_heads WHERE deployment=$1 AND region=$2`,[deployment,region]),
      this.pool.query<PolicyRow>(`SELECT r.* FROM admin_route_policy_heads h JOIN admin_route_policy_revisions r ON r.policy_id=h.policy_id AND r.revision=h.published_revision WHERE h.region=$1 ORDER BY h.platform`,[region])
    ]);
    return RoutePolicySnapshotSchema.parse({schemaVersion:"1",revision:Number(projection.rows[0]?.durable_revision??0),
      generatedAt:(projection.rows[0]?.database_now??new Date()).toISOString(),policies:policies.rows.map((row)=>{const policy=mapPolicy(row);return{platform:policy.platform,region:policy.region,policyRevision:policy.revision,orderedProviderIds:policy.orderedProviderIds,concurrencyCaps:policy.concurrencyCaps};})});
  }

  async finishPropagation(input:{deployment:string;region:string;commandId:string;projectionRevision:number;success:boolean}):Promise<AdminMutationReceipt>{
    const client=await this.pool.connect();try{await client.query("BEGIN");
      await client.query(`UPDATE admin_route_policy_projection_heads SET projected_revision=CASE WHEN $4 THEN $3 ELSE NULL END,state=CASE WHEN $4 THEN 'propagated' ELSE 'propagation_failed' END,updated_at=NOW() WHERE deployment=$1 AND region=$2 AND durable_revision=$3`,[input.deployment,input.region,input.projectionRevision,input.success]);
      const result=await client.query<ReceiptRow>(`UPDATE admin_command_receipts SET propagated_revision=CASE WHEN $2 THEN $3 ELSE NULL END,state=CASE WHEN $2 THEN 'propagated' ELSE 'propagation_failed' END,completed_at=NOW() WHERE command_id=$1 RETURNING command_id,command_digest,aggregate_kind,target_id,expected_revision::text,accepted_revision::text,current_revision::text,propagated_revision::text,state,created_at,completed_at`,[input.commandId,input.success,input.projectionRevision]);
      if(!result.rows[0])throw new Error("Route-policy command receipt is unavailable.");await client.query("COMMIT");return mapReceipt(result.rows[0]);
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}

  async applySafetyControl(command:AdminRouteSafetyCommand,identity:RoutePolicyCommandIdentity):Promise<{receipt:AdminMutationReceipt;rolloutSnapshotRevision:number}>{
    const client=await this.pool.connect();try{await client.query("BEGIN");
      const replay=await existingReceipt(client,identity);if(replay){const current=await client.query<{revision:string}>(`SELECT COALESCE(MAX(id),0)::text AS revision FROM provider_rollout_rule_audit`);await client.query("COMMIT");return{receipt:replay,rolloutSnapshotRevision:Number(current.rows[0]?.revision??0)};}
      await client.query("SELECT pg_advisory_xact_lock(hashtext('tikdd:provider-rollout-rules'))");
      const snapshot=await client.query<{revision:string}>(`SELECT COALESCE(MAX(id),0)::text AS revision FROM provider_rollout_rule_audit`);
      const currentSnapshot=Number(snapshot.rows[0]?.revision??0);const expected=command.expectedRolloutRevision??0;
      if(currentSnapshot!==expected)throw new AdminRoutePolicyConflictError("The rollout snapshot changed before the safety command.");
      const ruleId=`admin-deny-${command.providerId}-${command.platform}-${command.region}`;
      const selected=await client.query<{revision:string;enabled:boolean;allocation_bps:number;expires_at:Date|null;before_rule:unknown}>(
        `SELECT revision::text,enabled,allocation_bps,expires_at,to_jsonb(provider_rollout_rules) AS before_rule FROM provider_rollout_rules WHERE rule_id=$1 FOR UPDATE`,[ruleId]);
      const previous=selected.rows[0];
      if(command.action==="resume"&&(!previous||previous.enabled||previous.allocation_bps!==0||(previous.expires_at!==null&&previous.expires_at<=new Date()))){
        throw new AdminRoutePolicyConflictError("No active Admin-created deny can be resumed.");
      }
      const revision=Number(previous?.revision??0)+1;const resumed=command.action==="resume";
      const after={id:ruleId,providerId:command.providerId,platform:command.platform,region:command.region,enabled:false,allocationBps:0,revision,activatesAt:new Date().toISOString(),expiresAt:resumed?new Date().toISOString():null};
      await client.query(
        `INSERT INTO provider_rollout_rules (rule_id,provider_id,platform,region,enabled,allocation_bps,revision,activates_at,expires_at,change_reason)
         VALUES ($1,$2,$3,$4,FALSE,0,$5,NOW(),$6,$7)
         ON CONFLICT (rule_id) DO UPDATE SET enabled=FALSE,allocation_bps=0,revision=$5,activates_at=NOW(),expires_at=$6,change_reason=$7,updated_at=NOW()`,
        [ruleId,command.providerId,command.platform,command.region,revision,resumed?new Date():null,command.reason]
      );
      const audit=await client.query<{revision:string}>(
        `INSERT INTO provider_rollout_rule_audit (rule_id,operator_id,reason,previous_revision,new_revision,before_rule,after_rule)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) RETURNING id::text AS revision`,
        [ruleId,identity.actorSubject,command.reason,previous?Number(previous.revision):null,revision,previous?JSON.stringify(previous.before_rule):null,JSON.stringify(after)]
      );
      const rolloutSnapshotRevision=Number(audit.rows[0]?.revision);
      const receipt=await insertReceipt(client,{identity,targetId:`${command.providerId}/${command.platform}/${command.region}`,
        expectedRevision:command.expectedRolloutRevision,acceptedRevision:revision,currentRevision:revision,propagatedRevision:null,state:"propagating",complete:false});
      await client.query("COMMIT");return{receipt,rolloutSnapshotRevision};
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }

  async acceptProbe(command:AdminRouteProbeCommand,identity:RoutePolicyCommandIdentity):Promise<{receipt:AdminMutationReceipt;rolloutSnapshotRevision:number}>{
    const client=await this.pool.connect();try{await client.query("BEGIN");const replay=await existingReceipt(client,identity);
      if(replay){await client.query("COMMIT");return{receipt:replay,rolloutSnapshotRevision:command.expectedRolloutRevision};}
      await client.query("SELECT pg_advisory_xact_lock(hashtext('tikdd:provider-rollout-rules'))");
      const snapshot=await client.query<{revision:string}>(`SELECT COALESCE(MAX(id),0)::text AS revision FROM provider_rollout_rule_audit`);
      if(Number(snapshot.rows[0]?.revision??0)!==command.expectedRolloutRevision)throw new AdminRoutePolicyConflictError("The rollout snapshot changed before the probe command.");
      const receipt=await insertReceipt(client,{identity,targetId:`${command.providerId}/${command.platform}/${command.region}`,
        expectedRevision:command.expectedRolloutRevision,acceptedRevision:command.expectedRolloutRevision,currentRevision:command.expectedRolloutRevision,
        propagatedRevision:null,state:"propagating",complete:false});await client.query("COMMIT");return{receipt,rolloutSnapshotRevision:command.expectedRolloutRevision};
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }

  async finishRuntimeCommand(commandId:string,runtimeRevision:number,success:boolean):Promise<AdminMutationReceipt>{
    const result=await this.pool.query<ReceiptRow>(`UPDATE admin_command_receipts SET propagated_revision=CASE WHEN $2 THEN $3 ELSE NULL END,
      state=CASE WHEN $2 THEN 'propagated' ELSE 'failed' END,completed_at=NOW() WHERE command_id=$1
      RETURNING command_id,command_digest,aggregate_kind,target_id,expected_revision::text,accepted_revision::text,current_revision::text,
      propagated_revision::text,state,created_at,completed_at`,[commandId,success,runtimeRevision]);
    if(!result.rows[0])throw new Error("Admin runtime command receipt is unavailable.");return mapReceipt(result.rows[0]);
  }
}
