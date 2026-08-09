import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { ProviderAttempt } from "@tikdd/contracts";
import { createDatabasePool, TaskRepository } from "./index";

const suffix = randomUUID().replaceAll("-", "");
const taskId = `tsk_${suffix}`;
const now = new Date();
const pool = createDatabasePool();
const tasks = new TaskRepository(pool);

const attempt: ProviderAttempt = {
  providerId: "region-verification",
  providerKind: "site-adapter",
  platform: "x",
  region: "ap-southeast-1",
  priority: 700,
  routeScore: 700_100,
  status: "failed",
  failureCode: "provider_timeout",
  retryable: true,
  fallbackAllowed: true,
  startedAt: now.toISOString(),
  finishedAt: new Date(now.getTime() + 10).toISOString(),
  durationMs: 10
};

try {
  await tasks.create({
    id: taskId,
    platform: "x",
    canonicalUrl: "https://x.com/region-verification/status/1",
    expiresAt: new Date(now.getTime() + 60 * 60 * 1_000)
  });
  await tasks.recordProviderAttempts(taskId, [attempt]);

  const persisted = await pool.query<{ region: string }>(
    `SELECT region
     FROM provider_attempts
     WHERE task_id = $1 AND provider_id = $2`,
    [taskId, attempt.providerId]
  );
  assert.equal(persisted.rows[0]?.region, "ap-southeast-1");

  await assert.rejects(
    pool.query(
      `INSERT INTO provider_attempts (
         task_id, provider_id, provider_kind, platform, region, priority, route_score, status,
         failure_code, retryable, fallback_allowed, started_at, finished_at, duration_ms
       ) VALUES ($1, $2, 'site-adapter', 'x', '*', 1, 1, 'failed',
         'provider_timeout', true, true, NOW(), NOW(), 0)`,
      [taskId, "invalid-region-verification"]
    ),
    (error: unknown) =>
      typeof error === "object" && error !== null && "code" in error && error.code === "23514"
  );

  const index = await pool.query<{ indexname: string }>(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = current_schema()
       AND tablename = 'provider_attempts'
       AND indexname = 'provider_attempts_circuit_health_idx'`
  );
  assert.equal(index.rows[0]?.indexname, "provider_attempts_circuit_health_idx");

  process.stdout.write("Provider attempt region migration verification passed.\n");
} finally {
  await pool.query("DELETE FROM resolve_tasks WHERE id = $1", [taskId]);
  await pool.end();
}
