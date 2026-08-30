import { randomUUID } from "node:crypto";
import {
  ProviderAttemptSchema,
  ResolveResultSchema,
  type Platform,
  type ProviderAttempt,
  type ProviderFailureCode,
  type ResolveResult,
  type ResolveTask,
  type TaskError
} from "@tikdd/contracts";
import {
  DeliveryTicketRecordIdSchema,
  EncryptedDeliveryCandidateSchema,
  type DeliveryMode,
  type EncryptedDeliveryCandidate
} from "@tikdd/delivery-core";
import {
  ProviderHealthObservationSchema,
  type ProviderHealthObservation
} from "@tikdd/routing-health";
import {
  RolloutRuleChangeSchema,
  RolloutRuleSchema,
  RolloutSnapshotSchema,
  type RolloutRule,
  type RolloutRuleChange,
  type RolloutSnapshot
} from "@tikdd/rollout-control";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

export * from "./task-admission";
export * from "./cleanup";
export * from "./operational-diagnostics";
export * from "./pilot-control";
export * from "./pilot-evidence";
export * from "./admin-control-plane";
export * from "./admin-route-policy";
export * from "./admin-platform-presentation";
export * from "./admin-content-management";
export * from "./admin-content-publication";
export * from "./admin-authentication";

interface TaskRow extends QueryResultRow {
  id: string;
  status: ResolveTask["status"];
  platform: Platform;
  canonical_url: string;
  result: unknown | null;
  error: TaskError | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  observation_class: "internal" | "public";
}

export interface NewResolveTask {
  id: string;
  platform: Platform;
  canonicalUrl: string;
  expiresAt: Date;
  observationClass?: "internal" | "public";
}

interface LockedTaskRow extends QueryResultRow {
  expires_at: Date;
  database_now: Date;
  observation_class: "internal" | "public";
}

interface ProviderHealthObservationRow extends QueryResultRow {
  task_id: string;
  provider_id: string;
  platform: Platform;
  region: string;
  status: "succeeded" | "failed";
  failure_code: ProviderFailureCode | null;
  duration_ms: number;
  finished_at: Date;
}

interface RolloutRuleRow extends QueryResultRow {
  rule_id: string;
  provider_id: string;
  platform: string;
  region: string;
  enabled: boolean;
  allocation_bps: number;
  revision: string;
  activates_at: Date;
  expires_at: Date | null;
}

interface RolloutRevisionRow extends QueryResultRow {
  revision: string;
  database_now: Date;
}

interface RolloutAuditRevisionRow extends QueryResultRow {
  revision: string;
  created_at: Date;
}

interface TicketCandidateRow extends QueryResultRow {
  ticket_id: string;
  candidate_id: string;
  task_id: string;
  format_id: string;
  provider_id: string;
  mode: DeliveryMode;
  host_policy_id: string;
  encryption_algorithm: "aes-256-gcm";
  encryption_key_id: string;
  encryption_iv: Buffer;
  encrypted_payload: Buffer;
  authentication_tag: Buffer;
  candidate_expires_at: Date;
  task_expires_at: Date;
  database_now: Date;
  platform: Platform;
  region: string;
  observation_class: "internal" | "public";
}

export interface IssuedDeliveryTicket {
  mode: DeliveryMode;
  expiresAt: string;
}

export interface DeliveryEvidenceContext {
  ticketId: string;
  providerId: string;
  platform: Platform;
  region: string;
  observationClass: "internal" | "public";
  mode: DeliveryMode;
}

export interface RedeemedDeliveryCandidate {
  taskId: string;
  candidate: EncryptedDeliveryCandidate;
  evidence: DeliveryEvidenceContext;
}

export class TaskCompletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskCompletionError";
  }
}

export class RolloutRuleConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RolloutRuleConflictError";
  }
}

function mapRolloutRule(row: RolloutRuleRow): RolloutRule {
  return RolloutRuleSchema.parse({
    id: row.rule_id,
    providerId: row.provider_id,
    platform: row.platform,
    region: row.region,
    enabled: row.enabled,
    allocationBps: row.allocation_bps,
    revision: Number(row.revision),
    activatesAt: row.activates_at.toISOString(),
    expiresAt: row.expires_at?.toISOString() ?? null
  });
}

export class RolloutRuleRepository {
  constructor(private readonly pool: Pool) {}

  async applyChange(input: RolloutRuleChange): Promise<RolloutRule> {
    const change = RolloutRuleChangeSchema.parse(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('tikdd:provider-rollout-rules'))");
      const selected = await client.query<RolloutRuleRow>(
        `SELECT rule_id, provider_id, platform, region, enabled, allocation_bps,
           revision::text, activates_at, expires_at
         FROM provider_rollout_rules
         WHERE rule_id = $1
         FOR UPDATE`,
        [change.rule.id]
      );
      const previous = selected.rows[0] ? mapRolloutRule(selected.rows[0]) : null;
      if (previous === null && change.expectedRevision !== null) {
        throw new RolloutRuleConflictError("The rollout rule does not exist at the expected revision.");
      }
      if (previous !== null && previous.revision !== change.expectedRevision) {
        throw new RolloutRuleConflictError("The rollout rule revision changed before this update.");
      }

      const next = RolloutRuleSchema.parse({
        ...change.rule,
        revision: (previous?.revision ?? 0) + 1
      });
      const updated = await client.query<RolloutRuleRow>(
        `INSERT INTO provider_rollout_rules (
           rule_id, provider_id, platform, region, enabled, allocation_bps, revision,
           activates_at, expires_at, change_reason
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (rule_id) DO UPDATE SET
           provider_id = EXCLUDED.provider_id,
           platform = EXCLUDED.platform,
           region = EXCLUDED.region,
           enabled = EXCLUDED.enabled,
           allocation_bps = EXCLUDED.allocation_bps,
           revision = EXCLUDED.revision,
           activates_at = EXCLUDED.activates_at,
           expires_at = EXCLUDED.expires_at,
           change_reason = EXCLUDED.change_reason,
           updated_at = NOW()
         RETURNING rule_id, provider_id, platform, region, enabled, allocation_bps,
           revision::text, activates_at, expires_at`,
        [
          next.id,
          next.providerId,
          next.platform,
          next.region,
          next.enabled,
          next.allocationBps,
          next.revision,
          next.activatesAt,
          next.expiresAt,
          change.reason
        ]
      );
      const persisted = mapRolloutRule(updated.rows[0] as RolloutRuleRow);
      const auditResult = await client.query<RolloutAuditRevisionRow>(
        `INSERT INTO provider_rollout_rule_audit (
           rule_id, operator_id, reason, previous_revision, new_revision, before_rule, after_rule
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
         RETURNING id::text AS revision, created_at`,
        [
          persisted.id,
          change.operatorId,
          change.reason,
          previous?.revision ?? null,
          persisted.revision,
          previous ? JSON.stringify(previous) : null,
          JSON.stringify(persisted)
        ]
      );
      const auditRevision = auditResult.rows[0] as RolloutAuditRevisionRow;
      const allRules = await client.query<RolloutRuleRow>(
        `SELECT rule_id, provider_id, platform, region, enabled, allocation_bps,
           revision::text, activates_at, expires_at
         FROM provider_rollout_rules
         ORDER BY rule_id`
      );
      RolloutSnapshotSchema.parse({
        schemaVersion: "1",
        revision: Number(auditRevision.revision),
        generatedAt: auditRevision.created_at.toISOString(),
        rules: allRules.rows.map(mapRolloutRule)
      });
      await client.query("COMMIT");
      return persisted;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async loadSnapshot(): Promise<RolloutSnapshot> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const revisionResult = await client.query<RolloutRevisionRow>(
        `SELECT COALESCE(MAX(id), 0)::text AS revision, NOW() AS database_now
         FROM provider_rollout_rule_audit`
      );
      const rulesResult = await client.query<RolloutRuleRow>(
        `SELECT rule_id, provider_id, platform, region, enabled, allocation_bps,
           revision::text, activates_at, expires_at
         FROM provider_rollout_rules
         ORDER BY rule_id`
      );
      const revision = revisionResult.rows[0] as RolloutRevisionRow;
      const snapshot = RolloutSnapshotSchema.parse({
        schemaVersion: "1",
        revision: Number(revision.revision),
        generatedAt: revision.database_now.toISOString(),
        rules: rulesResult.rows.map(mapRolloutRule)
      });
      await client.query("COMMIT");
      return snapshot;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

async function insertProviderAttempts(
  client: PoolClient,
  taskId: string,
  rawAttempts: readonly ProviderAttempt[]
): Promise<void> {
  for (const rawAttempt of rawAttempts) {
    const attempt = ProviderAttemptSchema.parse(rawAttempt);
    await client.query(
      `INSERT INTO provider_attempts (
         task_id, provider_id, provider_kind, platform, region, priority, route_score, status,
         failure_code, retryable, fallback_allowed, started_at, finished_at, duration_ms
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        taskId,
        attempt.providerId,
        attempt.providerKind,
        attempt.platform,
        attempt.region,
        attempt.priority,
        attempt.routeScore,
        attempt.status,
        attempt.failureCode,
        attempt.retryable,
        attempt.fallbackAllowed,
        attempt.startedAt,
        attempt.finishedAt,
        attempt.durationMs
      ]
    );
  }
}

function mapTask(row: TaskRow): ResolveTask {
  return {
    id: row.id,
    status: row.status,
    platform: row.platform,
    canonicalUrl: row.canonical_url,
    result: row.result ? ResolveResultSchema.parse(row.result) : null,
    error: row.error,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    expiresAt: row.expires_at.toISOString()
  };
}

export function createDatabasePool(databaseUrl = process.env.DATABASE_URL): Pool {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }
  const configuredMaximum = process.env.TIKDD_DATABASE_POOL_MAX ?? "10";
  const maximum = Number.parseInt(configuredMaximum, 10);
  if (!/^\d+$/.test(configuredMaximum) || !Number.isInteger(maximum) || maximum < 1 || maximum > 20) {
    throw new Error("TIKDD_DATABASE_POOL_MAX must be an integer between 1 and 20.");
  }

  return new Pool({ connectionString: databaseUrl, max: maximum });
}

export class TaskRepository {
  constructor(private readonly pool: Pool) {}

  async create(task: NewResolveTask): Promise<ResolveTask> {
    const result = await this.pool.query<TaskRow>(
      `INSERT INTO resolve_tasks (id, status, platform, canonical_url, expires_at, observation_class)
       VALUES ($1, 'queued', $2, $3, $4, $5)
       RETURNING *`,
      [task.id, task.platform, task.canonicalUrl, task.expiresAt, task.observationClass ?? "public"]
    );
    return mapTask(result.rows[0] as TaskRow);
  }

  async getById(id: string): Promise<ResolveTask | null> {
    const result = await this.pool.query<TaskRow>(
      `SELECT * FROM resolve_tasks WHERE id = $1 AND expires_at > NOW()`,
      [id]
    );
    return result.rows[0] ? mapTask(result.rows[0]) : null;
  }

  async markResolving(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE resolve_tasks
       SET status = 'resolving', updated_at = NOW(), error = NULL
       WHERE id = $1 AND expires_at > NOW()`,
      [id]
    );
  }

  async complete(id: string, result: ResolveResult): Promise<void> {
    await this.completeWithResolution(id, result, [], []);
  }

  async completeWithResolution(
    id: string,
    rawResult: ResolveResult,
    rawCandidates: readonly EncryptedDeliveryCandidate[],
    rawAttempts: readonly ProviderAttempt[]
  ): Promise<void> {
    const result = ResolveResultSchema.parse(rawResult);
    const candidates = rawCandidates.map((candidate) =>
      EncryptedDeliveryCandidateSchema.parse(candidate)
    );
    const attempts = rawAttempts.map((attempt) => ProviderAttemptSchema.parse(attempt));
    const successfulAttempt = attempts.find((attempt) =>
      attempt.status === "succeeded" && attempt.providerId === result.provenance.provider);
    const formatIds = new Set(result.formats.map(({ id: formatId }) => formatId));
    for (const candidate of candidates) {
      if (!formatIds.has(candidate.formatId)) {
        throw new TaskCompletionError("A persisted candidate does not match the public result.");
      }
      if (candidate.providerId !== result.provenance.provider) {
        throw new TaskCompletionError("A persisted candidate has the wrong provider provenance.");
      }
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query<LockedTaskRow>(
        `SELECT expires_at, observation_class, NOW() AS database_now
         FROM resolve_tasks
         WHERE id = $1
         FOR UPDATE`,
        [id]
      );
      const task = locked.rows[0];
      if (!task || task.expires_at <= task.database_now) {
        throw new TaskCompletionError("The task does not exist or has expired.");
      }

      await client.query("DELETE FROM delivery_candidates WHERE task_id = $1", [id]);
      for (const candidate of candidates) {
        if (!successfulAttempt) {
          throw new TaskCompletionError("A delivery candidate requires an attributable successful provider attempt.");
        }
        const requestedExpiry = new Date(candidate.expiresAt);
        const effectiveExpiry =
          requestedExpiry < task.expires_at ? requestedExpiry : task.expires_at;
        if (effectiveExpiry <= task.database_now) {
          throw new TaskCompletionError("A delivery candidate is already expired.");
        }
        await client.query(
          `INSERT INTO delivery_candidates (
             id, task_id, format_id, provider_id, platform, region, observation_class, mode, host_policy_id,
             encryption_algorithm, encryption_key_id, encryption_iv, encrypted_payload,
             authentication_tag, expires_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            candidate.id,
            id,
            candidate.formatId,
            candidate.providerId,
            result.source.platform,
            successfulAttempt.region,
            task.observation_class,
            candidate.mode,
            candidate.hostPolicyId,
            candidate.envelope.algorithm,
            candidate.envelope.keyId,
            Buffer.from(candidate.envelope.iv, "base64url"),
            Buffer.from(candidate.envelope.ciphertext, "base64url"),
            Buffer.from(candidate.envelope.authTag, "base64url"),
            effectiveExpiry
          ]
        );
      }

      await insertProviderAttempts(client, id, attempts);
      const updated = await client.query(
        `UPDATE resolve_tasks
         SET status = 'succeeded', result = $2::jsonb, error = NULL, updated_at = NOW()
         WHERE id = $1 AND expires_at > NOW()`,
        [id, JSON.stringify(result)]
      );
      if (updated.rowCount !== 1) {
        throw new TaskCompletionError("The task expired before completion.");
      }
      await client.query("DELETE FROM active_source_admissions WHERE task_id = $1", [id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async fail(id: string, error: TaskError): Promise<void> {
    await this.pool.query(
      `WITH failed_task AS (
         UPDATE resolve_tasks
         SET status = 'failed', error = $2::jsonb, updated_at = NOW()
         WHERE id = $1 AND expires_at > NOW()
         RETURNING id
       )
       DELETE FROM active_source_admissions
       WHERE task_id IN (SELECT id FROM failed_task)`,
      [id, JSON.stringify(error)]
    );
  }

  async recordProviderAttempts(id: string, attempts: readonly ProviderAttempt[]): Promise<void> {
    if (attempts.length === 0) {
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await insertProviderAttempts(client, id, attempts);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listProviderHealthObservations(since: Date): Promise<ProviderHealthObservation[]> {
    if (Number.isNaN(since.getTime())) {
      throw new Error("The provider health observation boundary is invalid.");
    }
    const result = await this.pool.query<ProviderHealthObservationRow>(
      `SELECT DISTINCT ON (task_id, provider_id, platform, region)
         task_id, provider_id, platform, region, status, failure_code, duration_ms, finished_at
       FROM provider_attempts
       WHERE finished_at >= $1
       ORDER BY task_id, provider_id, platform, region, finished_at DESC, id DESC`,
      [since]
    );
    return result.rows.map((row) =>
      ProviderHealthObservationSchema.parse({
        taskId: row.task_id,
        providerId: row.provider_id,
        platform: row.platform,
        region: row.region,
        status: row.status,
        failureCode: row.failure_code,
        durationMs: row.duration_ms,
        finishedAt: row.finished_at.toISOString()
      })
    );
  }

  async issueDeliveryTicket(input: {
    id: string;
    taskId: string;
    formatId: string;
    tokenHash: Uint8Array;
    maximumTtlMs: number;
  }): Promise<IssuedDeliveryTicket | null> {
    const id = DeliveryTicketRecordIdSchema.parse(input.id);
    const tokenHash = Buffer.from(input.tokenHash);
    if (tokenHash.byteLength !== 32 || input.maximumTtlMs < 1_000 || input.maximumTtlMs > 300_000) {
      throw new Error("Delivery ticket parameters are invalid.");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query<TicketCandidateRow>(
        `SELECT '' AS ticket_id,dc.id AS candidate_id,dc.task_id,dc.format_id,dc.provider_id,dc.mode,
           dc.platform,dc.region,dc.observation_class,
           dc.host_policy_id, dc.encryption_algorithm, dc.encryption_key_id, dc.encryption_iv,
           dc.encrypted_payload, dc.authentication_tag, dc.expires_at AS candidate_expires_at,
           rt.expires_at AS task_expires_at, NOW() AS database_now
         FROM delivery_candidates dc
         JOIN resolve_tasks rt ON rt.id = dc.task_id
         WHERE dc.task_id = $1 AND dc.format_id = $2 AND rt.status = 'succeeded'
           AND dc.expires_at > NOW() AND rt.expires_at > NOW()
         FOR SHARE OF dc, rt`,
        [input.taskId, input.formatId]
      );
      const row = selected.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return null;
      }
      const ttlExpiry = new Date(row.database_now.getTime() + input.maximumTtlMs);
      const expiresAt = [ttlExpiry, row.candidate_expires_at, row.task_expires_at].reduce(
        (earliest, value) => (value < earliest ? value : earliest)
      );
      await client.query(
        `INSERT INTO delivery_tickets (id, candidate_id, mode, token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, row.candidate_id, row.mode, tokenHash, expiresAt]
      );
      await client.query(
        `INSERT INTO provider_delivery_outcomes
         (outcome_id,provider_id,platform,region,observation_class,mode,stage,result_class,duration_ms,
          delivery_policy_version,taxonomy_version,occurred_at,expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,'ticket_creation','succeeded',0,1,1,$7,$8)`,
        [randomUUID(),row.provider_id,row.platform,row.region,row.observation_class,row.mode,
         row.database_now,new Date(row.database_now.getTime()+35*86_400_000)]
      );
      await client.query(
        `UPDATE delivery_tickets SET ticket_creation_outcome_emitted=TRUE WHERE id=$1`, [id]);
      await client.query("COMMIT");
      return { mode: row.mode, expiresAt: expiresAt.toISOString() };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async redeemDeliveryTicket(tokenHashInput: Uint8Array): Promise<RedeemedDeliveryCandidate | null> {
    const tokenHash = Buffer.from(tokenHashInput);
    if (tokenHash.byteLength !== 32) {
      return null;
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query<TicketCandidateRow>(
        `SELECT dt.id AS ticket_id,dc.id AS candidate_id,dc.task_id,dc.format_id,dc.provider_id,dc.mode,
           dc.platform,dc.region,dc.observation_class,
           dc.host_policy_id, dc.encryption_algorithm, dc.encryption_key_id, dc.encryption_iv,
           dc.encrypted_payload, dc.authentication_tag, dc.expires_at AS candidate_expires_at,
           rt.expires_at AS task_expires_at, NOW() AS database_now
         FROM delivery_tickets dt
         JOIN delivery_candidates dc ON dc.id = dt.candidate_id
         JOIN resolve_tasks rt ON rt.id = dc.task_id
         WHERE dt.token_hash = $1 AND dt.redeemed_at IS NULL AND dt.expires_at > NOW()
           AND dc.expires_at > NOW() AND rt.expires_at > NOW() AND rt.status = 'succeeded'
           AND dt.mode = dc.mode
         FOR UPDATE OF dt`,
        [tokenHash]
      );
      const row = selected.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query(
        `UPDATE delivery_tickets SET redeemed_at = NOW()
         WHERE token_hash = $1 AND redeemed_at IS NULL`,
        [tokenHash]
      );
      await client.query("COMMIT");
      return {
        taskId: row.task_id,
        evidence: {
          ticketId: row.ticket_id, providerId: row.provider_id, platform: row.platform,
          region: row.region, observationClass: row.observation_class, mode: row.mode
        },
        candidate: EncryptedDeliveryCandidateSchema.parse({
          id: row.candidate_id,
          formatId: row.format_id,
          providerId: row.provider_id,
          mode: row.mode,
          hostPolicyId: row.host_policy_id,
          envelope: {
            algorithm: row.encryption_algorithm,
            keyId: row.encryption_key_id,
            iv: row.encryption_iv.toString("base64url"),
            ciphertext: row.encrypted_payload.toString("base64url"),
            authTag: row.authentication_tag.toString("base64url")
          },
          expiresAt: row.candidate_expires_at.toISOString()
        })
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordDeliveryRedemptionOutcome(input: {
    context: DeliveryEvidenceContext;
    result: "passed" | "candidate_expired" | "host_rejected" | "dns_rejected" | "mode_rejected" | "internal_error";
    durationMs: number;
    browserHandoff: boolean;
  }): Promise<void> {
    const durationMs = Math.max(0, Math.min(120_000, Math.round(input.durationMs)));
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const ticket = await client.query<{ database_now: Date; validation: boolean; handoff: boolean }>(
        `SELECT NOW() AS database_now,redirect_validation_outcome_emitted AS validation,
           browser_handoff_outcome_emitted AS handoff
         FROM delivery_tickets WHERE id=$1 FOR UPDATE`, [input.context.ticketId]);
      const row = ticket.rows[0];
      if (!row) throw new Error("Delivery ticket evidence context is no longer available.");
      const expiresAt = new Date(row.database_now.getTime()+35*86_400_000);
      if (!row.validation) {
        await client.query(
          `INSERT INTO provider_delivery_outcomes
           (outcome_id,provider_id,platform,region,observation_class,mode,stage,result_class,duration_ms,
            delivery_policy_version,taxonomy_version,occurred_at,expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,'redirect_validation',$7,$8,1,1,$9,$10)`,
          [randomUUID(),input.context.providerId,input.context.platform,input.context.region,
           input.context.observationClass,input.context.mode,input.result,durationMs,row.database_now,expiresAt]);
        await client.query(
          `UPDATE delivery_tickets SET redirect_validation_outcome_emitted=TRUE WHERE id=$1`,
          [input.context.ticketId]);
      }
      if (input.browserHandoff && !row.handoff) {
        await client.query(
          `INSERT INTO provider_delivery_outcomes
           (outcome_id,provider_id,platform,region,observation_class,mode,stage,result_class,duration_ms,
            delivery_policy_version,taxonomy_version,occurred_at,expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,'browser_handoff','redirect_issued',$7,1,1,$8,$9)`,
          [randomUUID(),input.context.providerId,input.context.platform,input.context.region,
           input.context.observationClass,input.context.mode,durationMs,row.database_now,expiresAt]);
        await client.query(
          `UPDATE delivery_tickets SET browser_handoff_outcome_emitted=TRUE WHERE id=$1`,
          [input.context.ticketId]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

}
