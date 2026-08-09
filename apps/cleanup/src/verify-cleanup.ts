import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { CleanupRepository, createDatabasePool } from "@tikdd/persistence";
import Redis from "ioredis";
import type { CleanupConfiguration } from "./configuration";
import { RedisCleanupLease } from "./lease";
import { runCleanup } from "./runner";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl || !redisUrl) {
  throw new Error("DATABASE_URL and REDIS_URL are required for cleanup verification.");
}

const suffix = randomUUID().replaceAll("-", "");
const cleanupSuffix = randomUUID().replaceAll("-", "");
const freshSuffix = randomUUID().replaceAll("-", "");
const deployment = `verify-${suffix.slice(0, 12)}`;
const pool = createDatabasePool(databaseUrl);
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
const repository = new CleanupRepository(pool);
const leaseSource = new RedisCleanupLease(redis, deployment);
const configuration: CleanupConfiguration = {
  deployment,
  intervalMs: 60_000,
  batchSize: 1,
  taskHardRetentionMs: 60 * 60 * 1_000,
  statementTimeoutMs: 2_000,
  timeBudgetMs: 30_000,
  maxBatches: 600,
  leaseTtlMs: 40_000
};

const cascadeTaskId = `tsk_${suffix}`;
const cleanupTaskId = `tsk_${cleanupSuffix}`;
const freshTaskId = `tsk_${freshSuffix}`;
const taskIds = [cascadeTaskId, cleanupTaskId, freshTaskId];

function digest(label: string): Buffer {
  return createHash("sha256").update(`${label}:${suffix}`).digest();
}

async function insertFixture(input: {
  taskId: string;
  candidateId: string;
  ticketId: string;
  createdAt: Date;
  expiresAt: Date;
  includeControls: boolean;
  includeAttempt: boolean;
}): Promise<void> {
  await pool.query(
    `INSERT INTO resolve_tasks
       (id, status, platform, canonical_url, created_at, updated_at, expires_at)
     VALUES ($1, 'succeeded', 'x', $2, $3, $3, $4)`,
    [input.taskId, `https://x.com/cleanup-verification/status/${input.taskId}`, input.createdAt, input.expiresAt]
  );
  await pool.query(
    `INSERT INTO delivery_candidates (
       id, task_id, format_id, provider_id, mode, host_policy_id, encryption_algorithm,
       encryption_key_id, encryption_iv, encrypted_payload, authentication_tag,
       created_at, updated_at, expires_at
     ) VALUES ($1, $2, 'fixture', 'cleanup-verifier', 'redirect', 'cleanup-verifier',
       'aes-256-gcm', 'cleanup-verifier-v1', $3, $4, $5, $6, $6, $7)`,
    [input.candidateId, input.taskId, Buffer.alloc(12, 1), Buffer.alloc(32, 2), Buffer.alloc(16, 3), input.createdAt, input.expiresAt]
  );
  await pool.query(
    `INSERT INTO delivery_tickets
       (id, candidate_id, mode, token_hash, created_at, expires_at)
     VALUES ($1, $2, 'redirect', $3, $4, $5)`,
    [input.ticketId, input.candidateId, digest(`ticket:${input.taskId}`), input.createdAt, input.expiresAt]
  );
  if (input.includeControls) {
    await pool.query(
      `INSERT INTO resolve_task_idempotency
         (key_digest, request_fingerprint, task_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [digest(`key:${input.taskId}`), digest(`request:${input.taskId}`), input.taskId, input.createdAt, input.expiresAt]
    );
    await pool.query(
      `INSERT INTO active_source_admissions
         (source_fingerprint, task_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [digest(`source:${input.taskId}`), input.taskId, input.createdAt, input.expiresAt]
    );
  }
  if (input.includeAttempt) {
    await pool.query(
      `INSERT INTO provider_attempts (
         task_id, provider_id, provider_kind, platform, region, priority, route_score,
         status, started_at, finished_at, duration_ms, created_at
       ) VALUES ($1, 'cleanup-verifier', 'api', 'x', 'global', 1, 1,
         'succeeded', $2, $2, 0, $2)`,
      [input.taskId, input.createdAt]
    );
  }
}

try {
  const now = Date.now();
  await insertFixture({
    taskId: cascadeTaskId,
    candidateId: `dvc_${suffix}`,
    ticketId: `dtk_${suffix}`,
    createdAt: new Date("2000-01-01T00:00:00.000Z"),
    expiresAt: new Date("2000-01-02T00:00:00.000Z"),
    includeControls: false,
    includeAttempt: true
  });
  await insertFixture({
    taskId: cleanupTaskId,
    candidateId: `dvc_${cleanupSuffix}`,
    ticketId: `dtk_${cleanupSuffix}`,
    createdAt: new Date("2000-01-03T00:00:00.000Z"),
    expiresAt: new Date("2000-01-04T00:00:00.000Z"),
    includeControls: true,
    includeAttempt: true
  });
  await insertFixture({
    taskId: freshTaskId,
    candidateId: `dvc_${freshSuffix}`,
    ticketId: `dtk_${freshSuffix}`,
    createdAt: new Date(now - 60_000),
    expiresAt: new Date(now + 60 * 60 * 1_000),
    includeControls: true,
    includeAttempt: false
  });

  const dryRun = await runCleanup({ repository, leaseSource, configuration, dryRun: true });
  assert.equal(dryRun.errors, 0);
  assert.ok(dryRun.rows.hardDeletedTasks >= 2);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM resolve_tasks WHERE id = ANY($1)", [taskIds])).rows[0]?.count, 3);

  assert.equal(await redis.set(leaseSource.storageKey(), "contender", "PX", 20_000, "NX"), "OK");
  const contended = await runCleanup({ repository, leaseSource, configuration });
  assert.equal(contended.stoppedReason, "lease-unavailable");
  assert.equal(await redis.del(leaseSource.storageKey()), 1);

  const cascadeCount = await repository.processStage("hardDeletedTasks", {
    batchSize: 1,
    taskHardRetentionMs: configuration.taskHardRetentionMs,
    statementTimeoutMs: configuration.statementTimeoutMs
  });
  assert.equal(cascadeCount, 1);
  const cascaded = await pool.query(
    `SELECT
       (SELECT count(*) FROM resolve_tasks WHERE id = $1)::int AS tasks,
       (SELECT count(*) FROM delivery_candidates WHERE task_id = $1)::int AS candidates,
       (SELECT count(*) FROM provider_attempts WHERE task_id = $1)::int AS attempts`,
    [cascadeTaskId]
  );
  assert.deepEqual(cascaded.rows[0], { tasks: 0, candidates: 0, attempts: 0 });

  const firstRun = await runCleanup({ repository, leaseSource, configuration });
  assert.equal(firstRun.errors, 0, JSON.stringify(firstRun));
  assert.equal(firstRun.stoppedReason, "complete");
  assert.ok(firstRun.rows.hardDeletedTasks >= 1);
  const remaining = await pool.query(
    `SELECT id FROM resolve_tasks WHERE id = ANY($1) ORDER BY id`,
    [taskIds]
  );
  assert.deepEqual(remaining.rows.map((row) => row.id), [freshTaskId]);

  const repeatedRun = await runCleanup({ repository, leaseSource, configuration });
  assert.equal(repeatedRun.errors, 0, JSON.stringify(repeatedRun));
  assert.equal(Object.values(repeatedRun.rows).reduce((sum, value) => sum + value, 0), 0);
  assert.equal(await redis.exists(leaseSource.storageKey()), 0);

  process.stdout.write(
    `${JSON.stringify({ dryRun: dryRun.rows, firstRun: firstRun.rows, repeatedRun: repeatedRun.rows, cascadeVerified: true, leaseContentionVerified: true })}\n`
  );
} finally {
  await pool.query("DELETE FROM resolve_tasks WHERE id = ANY($1)", [taskIds]).catch(() => undefined);
  await redis.del(leaseSource.storageKey()).catch(() => undefined);
  await Promise.all([pool.end(), redis.quit().catch(() => undefined)]);
}
