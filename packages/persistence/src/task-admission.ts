import {
  ResolveResultSchema,
  type Platform,
  type ResolveTask,
  type TaskError
} from "@tikdd/contracts";
import { timingSafeEqual } from "node:crypto";
import type { Pool, QueryResultRow } from "pg";

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

interface IdempotencyTaskRow extends TaskRow {
  request_fingerprint: Buffer;
}

interface ActiveAdmissionRow extends QueryResultRow {
  expires_at: Date;
  database_now: Date;
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

function digest(input: Uint8Array, name: string): Buffer {
  const value = Buffer.from(input);
  if (value.byteLength !== 32) {
    throw new Error(`${name} must contain exactly 32 bytes.`);
  }
  return value;
}

export interface TaskAdmissionInput {
  task: {
    id: string;
    platform: Platform;
    canonicalUrl: string;
    expiresAt: Date;
    observationClass?: "internal" | "public";
  };
  sourceFingerprint: Uint8Array;
  requestFingerprint: Uint8Array;
  idempotencyKeyDigest: Uint8Array | null;
  activeSourceExpiresAt: Date;
}

export type TaskAdmissionResult =
  | { kind: "created"; task: ResolveTask }
  | { kind: "replayed"; task: ResolveTask }
  | { kind: "duplicate"; retryAfterSeconds: number };

export class TaskIdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key was already used for a different request.");
    this.name = "TaskIdempotencyConflictError";
  }
}

export class TaskAdmissionRepository {
  constructor(private readonly pool: Pool) {}

  async admit(input: TaskAdmissionInput): Promise<TaskAdmissionResult> {
    const observationClass = input.task.observationClass ?? "public";
    const sourceFingerprint = digest(input.sourceFingerprint, "sourceFingerprint");
    const requestFingerprint = digest(input.requestFingerprint, "requestFingerprint");
    const idempotencyKeyDigest = input.idempotencyKeyDigest
      ? digest(input.idempotencyKeyDigest, "idempotencyKeyDigest")
      : null;
    if (
      Number.isNaN(input.task.expiresAt.getTime()) ||
      Number.isNaN(input.activeSourceExpiresAt.getTime()) ||
      input.activeSourceExpiresAt > input.task.expiresAt
    ) {
      throw new Error("Task admission expiry is invalid.");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const lockSubjects = [
        `source:${sourceFingerprint.toString("hex")}`,
        ...(idempotencyKeyDigest
          ? [`idempotency:${idempotencyKeyDigest.toString("hex")}`]
          : [])
      ].sort();
      for (const subject of lockSubjects) {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [subject]);
      }

      if (idempotencyKeyDigest) {
        await client.query(
          "DELETE FROM resolve_task_idempotency WHERE key_digest = $1 AND expires_at <= NOW()",
          [idempotencyKeyDigest]
        );
        const replay = await client.query<IdempotencyTaskRow>(
          `SELECT i.request_fingerprint, t.*
           FROM resolve_task_idempotency i
           JOIN resolve_tasks t ON t.id = i.task_id
           WHERE i.key_digest = $1 AND i.expires_at > NOW() AND t.expires_at > NOW()
           FOR UPDATE OF i, t`,
          [idempotencyKeyDigest]
        );
        const existing = replay.rows[0];
        if (existing) {
          if (existing.observation_class !== observationClass) {
            throw new TaskIdempotencyConflictError();
          }
          if (!timingSafeEqual(existing.request_fingerprint, requestFingerprint)) {
            throw new TaskIdempotencyConflictError();
          }
          await client.query("COMMIT");
          return { kind: "replayed", task: mapTask(existing) };
        }
      }

      await client.query(
        `DELETE FROM active_source_admissions a
         USING resolve_tasks t
         WHERE a.source_fingerprint = $1 AND a.task_id = t.id
           AND (a.expires_at <= NOW() OR t.expires_at <= NOW()
             OR t.status IN ('succeeded', 'failed', 'expired'))`,
        [sourceFingerprint]
      );
      const active = await client.query<ActiveAdmissionRow>(
        `SELECT expires_at, NOW() AS database_now
         FROM active_source_admissions
         WHERE source_fingerprint = $1 AND expires_at > NOW()
         FOR UPDATE`,
        [sourceFingerprint]
      );
      const activeRow = active.rows[0];
      if (activeRow) {
        const retryAfterSeconds = Math.min(
          60,
          Math.max(1, Math.ceil((activeRow.expires_at.getTime() - activeRow.database_now.getTime()) / 1_000))
        );
        await client.query("COMMIT");
        return { kind: "duplicate", retryAfterSeconds };
      }

      const created = await client.query<TaskRow>(
        `INSERT INTO resolve_tasks (id, status, platform, canonical_url, expires_at, observation_class)
         VALUES ($1, 'queued', $2, $3, $4, $5)
         RETURNING *`,
        [input.task.id, input.task.platform, input.task.canonicalUrl, input.task.expiresAt, observationClass]
      );
      await client.query(
        `INSERT INTO active_source_admissions (source_fingerprint, task_id, expires_at)
         VALUES ($1, $2, $3)`,
        [sourceFingerprint, input.task.id, input.activeSourceExpiresAt]
      );
      if (idempotencyKeyDigest) {
        await client.query(
          `INSERT INTO resolve_task_idempotency (
             key_digest, request_fingerprint, task_id, expires_at
           ) VALUES ($1, $2, $3, $4)`,
          [idempotencyKeyDigest, requestFingerprint, input.task.id, input.task.expiresAt]
        );
      }
      await client.query("COMMIT");
      return { kind: "created", task: mapTask(created.rows[0] as TaskRow) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
