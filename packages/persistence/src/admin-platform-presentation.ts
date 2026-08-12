import {
  AdminMutationReceiptSchema,
  AdminPlatformPresentationRevisionSchemaV2,
  type AdminMutationReceipt,
  type AdminPlatformPresentationRevisionV2
} from "@tikdd/admin-contracts";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import {
  AdminIdempotencyConflictError,
  AdminRoutePolicyConflictError,
  type RoutePolicyCommandIdentity
} from "./admin-route-policy";

interface PresentationRow extends QueryResultRow {
  platform: string; region: string; revision: string;
  revision_kind: "draft" | "published" | "rollback"; previous_revision: string | null;
  public_display_name: string; support_label: string;
  public_availability: "hidden" | "preview" | "listed" | "paused";
  page_id: string | null; reason: string; actor_subject: string; created_at: Date;
}

interface HeadRow extends QueryResultRow {
  head_revision: string; draft_revision: string | null; published_revision: string | null;
}

interface ReceiptRow extends QueryResultRow {
  command_id: string; command_digest: Buffer; aggregate_kind: "platform_presentation";
  target_id: string; expected_revision: string | null; accepted_revision: string | null;
  current_revision: string | null; propagated_revision: string | null;
  state: AdminMutationReceipt["state"]; created_at: Date; completed_at: Date | null;
}

export interface AdminPlatformPresentationState {
  headRevision: number | null;
  draft: AdminPlatformPresentationRevisionV2 | null;
  published: AdminPlatformPresentationRevisionV2 | null;
}

export interface PlatformPresentationValues {
  platform: string; region: string; expectedRevision: number | null;
  publicDisplayName: string; supportLabel: string;
  publicAvailability: "hidden" | "preview" | "listed" | "paused";
  pageId: string | null; reason: string;
}

function mapRevision(row: PresentationRow): AdminPlatformPresentationRevisionV2 {
  return AdminPlatformPresentationRevisionSchemaV2.parse({
    schemaVersion: "1", platform: row.platform, region: row.region, revision: Number(row.revision),
    revisionKind: row.revision_kind, previousRevision: row.previous_revision === null ? null : Number(row.previous_revision),
    publicDisplayName: row.public_display_name, supportLabel: row.support_label,
    publicAvailability: row.public_availability, pageId: row.page_id,
    reason: row.reason, actorSubject: row.actor_subject, createdAt: row.created_at.toISOString()
  });
}

function mapReceipt(row: ReceiptRow): AdminMutationReceipt {
  return AdminMutationReceiptSchema.parse({
    schemaVersion: "1", commandId: row.command_id, aggregate: row.aggregate_kind, targetId: row.target_id,
    expectedRevision: row.expected_revision === null ? null : Number(row.expected_revision),
    acceptedRevision: row.accepted_revision === null ? null : Number(row.accepted_revision),
    currentRevision: row.current_revision === null ? null : Number(row.current_revision),
    propagatedRevision: row.propagated_revision === null ? null : Number(row.propagated_revision),
    state: row.state, acceptedAt: row.created_at.toISOString(), completedAt: row.completed_at?.toISOString() ?? null
  });
}

async function replay(client: PoolClient, identity: RoutePolicyCommandIdentity): Promise<AdminMutationReceipt | null> {
  const result = await client.query<ReceiptRow>(
    `SELECT command_id,command_digest,aggregate_kind,target_id,expected_revision::text,accepted_revision::text,
       current_revision::text,propagated_revision::text,state,created_at,completed_at
     FROM admin_command_receipts WHERE idempotency_digest=$1 AND expires_at>NOW() FOR UPDATE`,
    [identity.idempotencyDigest]
  );
  const row = result.rows[0];
  if (!row) return null;
  if (!row.command_digest.equals(identity.commandDigest)) throw new AdminIdempotencyConflictError();
  return mapReceipt(row);
}

async function head(client: PoolClient, platform: string, region: string): Promise<HeadRow | null> {
  const result = await client.query<HeadRow>(
    `SELECT head_revision::text,draft_revision::text,published_revision::text
     FROM admin_platform_presentation_heads WHERE platform=$1 AND region=$2 FOR UPDATE`, [platform, region]);
  return result.rows[0] ?? null;
}

function expectRevision(current: HeadRow | null, expected: number | null): void {
  if ((current ? Number(current.head_revision) : null) !== expected) throw new AdminRoutePolicyConflictError();
}

async function receipt(client: PoolClient, input: {
  identity: RoutePolicyCommandIdentity; targetId: string; expectedRevision: number | null;
  acceptedRevision: number | null; currentRevision: number | null;
}): Promise<AdminMutationReceipt> {
  const result = await client.query<ReceiptRow>(
    `INSERT INTO admin_command_receipts
       (command_id,idempotency_digest,command_digest,aggregate_kind,target_id,actor_subject,
        expected_revision,accepted_revision,current_revision,propagated_revision,state,completed_at,expires_at)
     VALUES ($1,$2,$3,'platform_presentation',$4,$5,$6,$7,$8,$8,'propagated',NOW(),$9)
     RETURNING command_id,command_digest,aggregate_kind,target_id,expected_revision::text,accepted_revision::text,
       current_revision::text,propagated_revision::text,state,created_at,completed_at`,
    [input.identity.commandId,input.identity.idempotencyDigest,input.identity.commandDigest,input.targetId,
      input.identity.actorSubject,input.expectedRevision,input.acceptedRevision,input.currentRevision,input.identity.expiresAt]
  );
  return mapReceipt(result.rows[0] as ReceiptRow);
}

export class AdminPlatformPresentationRepository {
  constructor(private readonly pool: Pool) {}

  async getState(platform: string, region: string): Promise<AdminPlatformPresentationState> {
    const selected = await this.pool.query<HeadRow>(
      `SELECT head_revision::text,draft_revision::text,published_revision::text
       FROM admin_platform_presentation_heads WHERE platform=$1 AND region=$2`, [platform, region]);
    const current = selected.rows[0];
    if (!current) return { headRevision: null, draft: null, published: null };
    const ids = [current.draft_revision, current.published_revision].filter((value): value is string => value !== null);
    const revisions = ids.length === 0 ? [] : (await this.pool.query<PresentationRow>(
      `SELECT * FROM admin_platform_presentation_revisions
       WHERE platform=$1 AND region=$2 AND revision=ANY($3::bigint[])`, [platform, region, ids])).rows.map(mapRevision);
    return {
      headRevision: Number(current.head_revision),
      draft: current.draft_revision === null ? null : revisions.find(({ revision }) => revision === Number(current.draft_revision)) ?? null,
      published: current.published_revision === null ? null : revisions.find(({ revision }) => revision === Number(current.published_revision)) ?? null
    };
  }

  async getRevision(platform: string, region: string, revision: number): Promise<AdminPlatformPresentationRevisionV2 | null> {
    const result = await this.pool.query<PresentationRow>(
      `SELECT * FROM admin_platform_presentation_revisions WHERE platform=$1 AND region=$2 AND revision=$3`,
      [platform, region, revision]);
    return result.rows[0] ? mapRevision(result.rows[0]) : null;
  }

  async saveDraft(values: PlatformPresentationValues, identity: RoutePolicyCommandIdentity): Promise<AdminMutationReceipt> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const prior = await replay(client, identity); if (prior) { await client.query("COMMIT"); return prior; }
      const current = await head(client, values.platform, values.region); expectRevision(current, values.expectedRevision);
      const next = (current ? Number(current.head_revision) : 0) + 1;
      await client.query(
        `INSERT INTO admin_platform_presentation_revisions
          (platform,region,revision,revision_kind,previous_revision,public_display_name,support_label,
           public_availability,page_id,reason,actor_subject)
         VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10)`,
        [values.platform,values.region,next,current?.published_revision ?? null,values.publicDisplayName,
          values.supportLabel,values.publicAvailability,values.pageId,values.reason,identity.actorSubject]);
      await client.query(
        `INSERT INTO admin_platform_presentation_heads (platform,region,head_revision,draft_revision,published_revision)
         VALUES ($1,$2,$3,$3,NULL)
         ON CONFLICT (platform,region) DO UPDATE SET head_revision=$3,draft_revision=$3,updated_at=NOW()`,
        [values.platform,values.region,next]);
      const result = await receipt(client,{identity,targetId:`${values.platform}/${values.region}`,
        expectedRevision:values.expectedRevision,acceptedRevision:next,currentRevision:next});
      await client.query("COMMIT"); return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async publish(input: { platform:string;region:string;expectedRevision:number;draftRevision:number;reason:string }, identity: RoutePolicyCommandIdentity) {
    return this.promote({...input,sourceRevision:input.draftRevision,kind:"published" as const},identity);
  }

  async rollback(input: { platform:string;region:string;expectedRevision:number;targetRevision:number;reason:string }, identity: RoutePolicyCommandIdentity) {
    return this.promote({...input,sourceRevision:input.targetRevision,kind:"rollback" as const},identity);
  }

  private async promote(input:{platform:string;region:string;expectedRevision:number;sourceRevision:number;reason:string;kind:"published"|"rollback"},identity:RoutePolicyCommandIdentity):Promise<AdminMutationReceipt>{
    const client=await this.pool.connect();
    try{
      await client.query("BEGIN");const prior=await replay(client,identity);if(prior){await client.query("COMMIT");return prior;}
      const current=await head(client,input.platform,input.region);expectRevision(current,input.expectedRevision);
      if(!current||(input.kind==="published"&&Number(current.draft_revision)!==input.sourceRevision))throw new AdminRoutePolicyConflictError();
      const selected=await client.query<PresentationRow>(`SELECT * FROM admin_platform_presentation_revisions WHERE platform=$1 AND region=$2 AND revision=$3 FOR SHARE`,[input.platform,input.region,input.sourceRevision]);
      const source=selected.rows[0]?mapRevision(selected.rows[0]):null;
      if(!source||(input.kind==="rollback"&&source.revisionKind==="draft"))throw new AdminRoutePolicyConflictError();
      const next=Number(current.head_revision)+1;
      await client.query(`INSERT INTO admin_platform_presentation_revisions
        (platform,region,revision,revision_kind,previous_revision,public_display_name,support_label,public_availability,page_id,reason,actor_subject)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[input.platform,input.region,next,input.kind,current.published_revision,
        source.publicDisplayName,source.supportLabel,source.publicAvailability,source.pageId,input.reason,identity.actorSubject]);
      await client.query(`UPDATE admin_platform_presentation_heads SET head_revision=$3,draft_revision=NULL,published_revision=$3,updated_at=NOW() WHERE platform=$1 AND region=$2`,[input.platform,input.region,next]);
      const result=await receipt(client,{identity,targetId:`${input.platform}/${input.region}`,expectedRevision:input.expectedRevision,acceptedRevision:next,currentRevision:next});
      await client.query("COMMIT");return result;
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }

  async discard(input:{platform:string;region:string;expectedRevision:number;draftRevision:number},identity:RoutePolicyCommandIdentity):Promise<AdminMutationReceipt>{
    const client=await this.pool.connect();try{await client.query("BEGIN");const prior=await replay(client,identity);if(prior){await client.query("COMMIT");return prior;}
      const current=await head(client,input.platform,input.region);expectRevision(current,input.expectedRevision);
      if(!current||Number(current.draft_revision)!==input.draftRevision)throw new AdminRoutePolicyConflictError();
      await client.query(`UPDATE admin_platform_presentation_heads SET draft_revision=NULL,updated_at=NOW() WHERE platform=$1 AND region=$2`,[input.platform,input.region]);
      const published=current.published_revision===null?null:Number(current.published_revision);
      const result=await receipt(client,{identity,targetId:`${input.platform}/${input.region}`,expectedRevision:input.expectedRevision,acceptedRevision:null,currentRevision:published});
      await client.query("COMMIT");return result;
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }
}
