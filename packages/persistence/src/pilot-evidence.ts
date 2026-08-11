import {
  DeliveryOutcomeSchema,
  PilotDailyEvidenceSchema,
  PilotPolicySchema,
  aggregatePilotEvidenceDay,
  type DeliveryOutcome,
  type PilotDailyEvidence,
  type PilotObservationClass,
  type PilotPolicy,
  type ResolutionEvidenceObservation
} from "@tikdd/rollout-control";
import type { Pool, QueryResultRow } from "pg";

interface ResolutionSourceRow extends QueryResultRow {
  task_id: string;
  provider_id: string;
  platform: string;
  region: string;
  observation_class: PilotObservationClass;
  status: "succeeded" | "failed";
  failure_code: ResolutionEvidenceObservation["failureCode"];
  started_at: Date;
  finished_at: Date;
  duration_ms: number;
  fallback_depth: number;
  result_format_count: number;
  candidate_count: number;
}

interface DeliveryOutcomeRow extends QueryResultRow {
  outcome_id: string;
  provider_id: string;
  platform: string;
  region: string;
  observation_class: PilotObservationClass;
  mode: DeliveryOutcome["mode"];
  stage: DeliveryOutcome["stage"];
  result_class: DeliveryOutcome["result"];
  duration_ms: number;
  occurred_at: Date;
  ingested_at: Date;
  expires_at: Date;
  delivery_policy_version: number;
  taxonomy_version: number;
}

interface DailyEvidenceRow extends QueryResultRow {
  summary: unknown;
  aggregate_revision: string;
  completeness: PilotDailyEvidence["completeness"];
}

export interface EvidenceDiagnosticQuery {
  providerId: string;
  platform: string;
  region: string;
  observationClass: PilotObservationClass;
  fromDay: string;
  toDay: string;
}

function mapDelivery(row: DeliveryOutcomeRow): DeliveryOutcome {
  return DeliveryOutcomeSchema.parse({
    outcomeId: row.outcome_id,
    providerId: row.provider_id,
    platform: row.platform,
    region: row.region,
    observationClass: row.observation_class,
    mode: row.mode,
    stage: row.stage,
    result: row.result_class,
    durationMs: row.duration_ms,
    occurredAt: row.occurred_at.toISOString(),
    ingestedAt: row.ingested_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    deliveryPolicyVersion: row.delivery_policy_version,
    taxonomyVersion: row.taxonomy_version
  });
}

function dayBounds(utcDay: string): { start: Date; end: Date } {
  const start = new Date(`${utcDay}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== utcDay) {
    throw new Error("UTC evidence day is invalid.");
  }
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export class PilotEvidenceRepository {
  constructor(private readonly pool: Pool) {}

  async recordDeliveryOutcome(raw: DeliveryOutcome): Promise<boolean> {
    const outcome = DeliveryOutcomeSchema.parse(raw);
    const result = await this.pool.query(
      `INSERT INTO provider_delivery_outcomes (
         outcome_id,provider_id,platform,region,observation_class,mode,stage,result_class,
         duration_ms,delivery_policy_version,taxonomy_version,occurred_at,ingested_at,expires_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (outcome_id) DO NOTHING`,
      [outcome.outcomeId, outcome.providerId, outcome.platform, outcome.region,
       outcome.observationClass, outcome.mode, outcome.stage, outcome.result, outcome.durationMs,
       outcome.deliveryPolicyVersion, outcome.taxonomyVersion, outcome.occurredAt,
       outcome.ingestedAt, outcome.expiresAt]
    );
    return result.rowCount === 1;
  }

  async rebuildUtcDay(utcDay: string, now = new Date()): Promise<PilotDailyEvidence[]> {
    const { start, end } = dayBounds(utcDay);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      const attempts = await client.query<ResolutionSourceRow>(
        `WITH terminal_tasks AS (
           SELECT id,status,result,updated_at,observation_class
           FROM resolve_tasks
           WHERE status IN ('succeeded','failed','expired') AND updated_at >= $1 AND updated_at < $2
         ), route_depth AS (
           SELECT pa.task_id,GREATEST(count(DISTINCT pa.provider_id)-1,0)::int AS fallback_depth
           FROM provider_attempts pa JOIN terminal_tasks rt ON rt.id=pa.task_id GROUP BY pa.task_id
         )
         SELECT pa.task_id,pa.provider_id,pa.platform,pa.region,rt.observation_class,
           CASE WHEN pa.status='succeeded' AND rt.status='succeeded'
             AND rt.result->'provenance'->>'provider'=pa.provider_id THEN 'succeeded' ELSE 'failed' END AS status,
           CASE WHEN pa.status='succeeded' AND rt.status='succeeded'
             AND rt.result->'provenance'->>'provider'=pa.provider_id THEN NULL ELSE pa.failure_code END AS failure_code,
           pa.started_at,pa.finished_at,LEAST(pa.duration_ms,120000)::int AS duration_ms,
           rd.fallback_depth,
           CASE WHEN rt.status='succeeded' AND rt.result->'provenance'->>'provider'=pa.provider_id
             THEN COALESCE(jsonb_array_length(rt.result->'formats'),0) ELSE 0 END::int AS result_format_count,
           CASE WHEN rt.status='succeeded' THEN (SELECT count(*)::int FROM delivery_candidates dc
             WHERE dc.task_id=pa.task_id AND dc.provider_id=pa.provider_id) ELSE 0 END AS candidate_count
         FROM provider_attempts pa
         JOIN terminal_tasks rt ON rt.id=pa.task_id
         JOIN route_depth rd ON rd.task_id=pa.task_id
         ORDER BY pa.task_id,pa.provider_id,pa.platform,pa.region,pa.finished_at,pa.id`,
        [start, end]
      );
      const canaries = await client.query<QueryResultRow & {
        run_id: string; canary_id: string; provider_id: string; platform: string; region: string;
        status: "succeeded" | "failed"; failure_code: ResolutionEvidenceObservation["failureCode"];
        duration_ms: number; fallback_depth: number; format_count: number | null; recorded_at: Date;
      }>(
        `SELECT run_id::text,canary_id,provider_id,platform,region,status,failure_code,duration_ms,
           fallback_depth,format_count,recorded_at
         FROM provider_canary_measurements WHERE recorded_at >= $1 AND recorded_at < $2`,
        [start, end]
      );
      const deliveries = await client.query<DeliveryOutcomeRow>(
        `SELECT outcome_id::text,provider_id,platform,region,observation_class,mode,stage,result_class,
           duration_ms,occurred_at,ingested_at,expires_at,delivery_policy_version,taxonomy_version
         FROM provider_delivery_outcomes WHERE occurred_at >= $1 AND occurred_at < $2`,
        [start, end]
      );
      const previous = await client.query<QueryResultRow & {
        provider_id: string; platform: string; region: string; observation_class: string;
        aggregate_revision: string; completeness: PilotDailyEvidence["completeness"];
      }>(
        `SELECT provider_id,platform,region,observation_class,aggregate_revision::text,completeness
         FROM provider_daily_evidence
         WHERE utc_day=$1 AND aggregation_version=1 AND taxonomy_version=1 FOR UPDATE`,
        [utcDay]
      );
      const revisionByTuple = new Map(previous.rows.map((row) => [
        `${row.provider_id}\0${row.platform}\0${row.region}\0${row.observation_class}`,
        Number(row.aggregate_revision)
      ]));
      const sealed = new Set(previous.rows.filter((row) => row.completeness === "sealed").map((row) =>
        `${row.provider_id}\0${row.platform}\0${row.region}\0${row.observation_class}`));
      const mappedDeliveries=deliveries.rows.map(mapDelivery);
      const lateGroups=new Map<string,DeliveryOutcome[]>();
      for(const item of mappedDeliveries){const key=`${item.providerId}\0${item.platform}\0${item.region}\0${item.observationClass}`;
        if(sealed.has(key)&&new Date(item.ingestedAt)>=new Date(end.getTime()+48*3_600_000)){const group=lateGroups.get(key)??[];group.push(item);lateGroups.set(key,group);}}
      for(const [key,items] of lateGroups){const [providerId,platform,region,observationClass]=key.split("\0");const watermark=[...items].sort((a,b)=>a.ingestedAt.localeCompare(b.ingestedAt)).at(-1)!.ingestedAt;
        await client.query(`INSERT INTO provider_late_evidence_counts
          (provider_id,platform,region,observation_class,source_utc_day,detected_utc_day,aggregation_version,taxonomy_version,late_count,source_watermark,expires_at)
          VALUES($1,$2,$3,$4,$5,$6,1,1,$7,$8,$9)
          ON CONFLICT(provider_id,platform,region,observation_class,source_utc_day,aggregation_version,taxonomy_version)
          DO UPDATE SET detected_utc_day=EXCLUDED.detected_utc_day,late_count=EXCLUDED.late_count,
            source_watermark=EXCLUDED.source_watermark,updated_at=NOW(),expires_at=EXCLUDED.expires_at`,
          [providerId,platform,region,observationClass,utcDay,now.toISOString().slice(0,10),items.length,watermark,new Date(end.getTime()+400*86_400_000)]);
      }
      const resolutions: ResolutionEvidenceObservation[] = [
        ...attempts.rows.map((row) => ({
          taskId: row.task_id, providerId: row.provider_id, platform: row.platform,
          region: row.region, observationClass: row.observation_class, status: row.status,
          failureCode: row.failure_code, startedAt: row.started_at.toISOString(),
          finishedAt: row.finished_at.toISOString(), durationMs: row.duration_ms,
          fallbackDepth: row.fallback_depth, resultFormatCount: row.result_format_count,
          candidateCount: row.candidate_count, absoluteStop: false
        })),
        ...canaries.rows.map((row) => ({
          taskId: `${row.run_id}:${row.canary_id}`, providerId: row.provider_id, platform: row.platform,
          region: row.region, observationClass: "canary" as const, status: row.status,
          failureCode: row.failure_code, startedAt: new Date(row.recorded_at.getTime()-row.duration_ms).toISOString(),
          finishedAt: row.recorded_at.toISOString(), durationMs: row.duration_ms,
          fallbackDepth: row.fallback_depth, resultFormatCount: row.format_count ?? 0,
          candidateCount: 0, absoluteStop: false
        }))
      ];
      const summaries = aggregatePilotEvidenceDay({ utcDay, resolutions, deliveries: mappedDeliveries, now, revisionByTuple })
        .filter((summary) => !sealed.has(`${summary.providerId}\0${summary.platform}\0${summary.region}\0${summary.observationClass}`));
      for (const summary of summaries) {
        await client.query(
          `INSERT INTO provider_daily_evidence (
             provider_id,platform,region,observation_class,utc_day,aggregation_version,taxonomy_version,
             completeness,source_watermark,aggregate_revision,summary,generated_at,expires_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)
           ON CONFLICT (provider_id,platform,region,observation_class,utc_day,aggregation_version,taxonomy_version)
           DO UPDATE SET completeness=EXCLUDED.completeness,source_watermark=EXCLUDED.source_watermark,
             aggregate_revision=EXCLUDED.aggregate_revision,summary=EXCLUDED.summary,
             generated_at=EXCLUDED.generated_at,expires_at=EXCLUDED.expires_at
           WHERE provider_daily_evidence.completeness <> 'sealed'
             AND provider_daily_evidence.aggregate_revision < EXCLUDED.aggregate_revision`,
          [summary.providerId, summary.platform, summary.region, summary.observationClass, summary.utcDay,
           summary.aggregationVersion, summary.taxonomyVersion, summary.completeness,
           summary.sourceWatermark, summary.aggregateRevision, JSON.stringify(summary),
           summary.generatedAt, summary.expiresAt]
        );
      }
      await client.query("COMMIT");
      return summaries;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listDailyEvidence(query: EvidenceDiagnosticQuery): Promise<PilotDailyEvidence[]> {
    dayBounds(query.fromDay); dayBounds(query.toDay);
    if ((new Date(`${query.toDay}T00:00:00Z`).getTime() - new Date(`${query.fromDay}T00:00:00Z`).getTime()) / 86_400_000 > 30) {
      throw new Error("Evidence queries are limited to 31 UTC days.");
    }
    const result = await this.pool.query<DailyEvidenceRow>(
      `SELECT summary,aggregate_revision::text,completeness FROM provider_daily_evidence
       WHERE provider_id=$1 AND platform=$2 AND region=$3 AND observation_class=$4
         AND utc_day BETWEEN $5 AND $6 AND expires_at>NOW()
       ORDER BY utc_day,aggregation_version,taxonomy_version`,
      [query.providerId, query.platform, query.region, query.observationClass, query.fromDay, query.toDay]
    );
    return result.rows.map((row) => PilotDailyEvidenceSchema.parse(row.summary));
  }

  async recordExport(query: EvidenceDiagnosticQuery, actorId: string, dayCount: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO provider_evidence_export_audit
       (provider_id,platform,region,observation_class,window_started_on,window_ended_on,day_count,actor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [query.providerId, query.platform, query.region, query.observationClass,
       query.fromDay, query.toDay, dayCount, actorId]
    );
  }

  async createCalibrationProposal(input:{proposalId:string;policy:PilotPolicy;evidenceOwnerId:string}):Promise<void>{
    const policy=PilotPolicySchema.parse(input.policy);
    const days=await this.listDailyEvidence({providerId:policy.providerId,platform:policy.platform,region:policy.region,
      observationClass:"internal",fromDay:policy.calibrationStartedAt.slice(0,10),toDay:new Date(new Date(policy.calibrationCompletedAt).getTime()-1).toISOString().slice(0,10)});
    if(days.length!==3||days.some((day)=>day.completeness!=="sealed")||days.map((day)=>day.aggregateRevision).join(",")!==policy.calibrationDayRevisions.join(","))throw new Error("Calibration proposal requires the exact three sealed internal day revisions.");
    await this.pool.query(`INSERT INTO provider_calibration_proposals
      (proposal_id,provider_id,platform,region,observation_class,aggregation_version,taxonomy_version,day_revisions,
       proposed_policy,status,evidence_owner_id,revision,expires_at)
      VALUES($1,$2,$3,$4,'internal',$5,$6,$7::jsonb,$8::jsonb,'proposed',$9,1,$10)`,
      [input.proposalId,policy.providerId,policy.platform,policy.region,policy.aggregationVersion,policy.taxonomyVersion,
       JSON.stringify(policy.calibrationDayRevisions),JSON.stringify(policy),input.evidenceOwnerId,
       new Date(new Date(policy.expiresAt).getTime()+400*86_400_000)]);
  }

  async reviewCalibrationProposal(input:{proposalId:string;expectedRevision:number;action:"lock_policy"|"reject_proposal";reviewId:string;reviewerId:string}):Promise<void>{
    const client=await this.pool.connect();try{await client.query("BEGIN");const selected=await client.query<{provider_id:string;platform:string;region:string;proposed_policy:unknown;day_revisions:unknown;revision:string;expires_at:Date}>(
      `SELECT provider_id,platform,region,proposed_policy,day_revisions,revision::text,expires_at
       FROM provider_calibration_proposals WHERE proposal_id=$1 AND status='proposed' FOR UPDATE`,[input.proposalId]);const row=selected.rows[0];
      if(!row||Number(row.revision)!==input.expectedRevision)throw new Error("Calibration proposal revision changed before review.");const policy=PilotPolicySchema.parse(row.proposed_policy);const status=input.action==="lock_policy"?"locked":"rejected";
      await client.query(`UPDATE provider_calibration_proposals SET status=$2,revision=revision+1,updated_at=NOW() WHERE proposal_id=$1`,[input.proposalId,status]);
      await client.query(`INSERT INTO provider_evidence_reviews
        (review_id,proposal_id,provider_id,platform,region,action,policy_id,policy_version,evidence_window_started_at,
         evidence_window_ended_at,day_revisions,reviewer_id,revision,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,1,$13)`,
        [input.reviewId,input.proposalId,row.provider_id,row.platform,row.region,input.action,policy.id,policy.version,
         policy.calibrationStartedAt,policy.calibrationCompletedAt,JSON.stringify(policy.calibrationDayRevisions),input.reviewerId,row.expires_at]);
      await client.query("COMMIT");}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }

  async recordEvaluatorRun(input: { deployment: string; ownerId: string; status: "completed"|"partial"|"failed"|"lease_unavailable"; tupleCount: number; changedGuardCount: number; startedAt: Date; finishedAt: Date; errorCode: string|null }): Promise<void> {
    await this.pool.query(
      `INSERT INTO provider_evidence_evaluator_runs
       (deployment,owner_id,status,tuple_count,changed_guard_count,started_at,finished_at,error_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [input.deployment,input.ownerId,input.status,input.tupleCount,input.changedGuardCount,
       input.startedAt,input.finishedAt,input.errorCode]
    );
  }

  async latestEvaluatorRun(): Promise<Record<string, unknown> | null> {
    const result = await this.pool.query<QueryResultRow>(
      `SELECT deployment,status,tuple_count AS "tupleCount",changed_guard_count AS "changedGuardCount",
         started_at AS "startedAt",finished_at AS "finishedAt",error_code AS "errorCode"
       FROM provider_evidence_evaluator_runs ORDER BY id DESC LIMIT 1`
    );
    const row = result.rows[0];
    if (!row) return null;
    return { ...row, startedAt: (row.startedAt as Date).toISOString(), finishedAt: (row.finishedAt as Date).toISOString() };
  }
}
