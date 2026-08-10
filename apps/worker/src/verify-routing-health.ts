import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { ProviderAttempt } from "@tikdd/contracts";
import { createDatabasePool, TaskRepository } from "@tikdd/persistence";
import {
  CircuitPolicySchema,
  RedisCircuitStore,
  circuitStorageKey,
  refreshCircuitHealth,
  type ProviderCircuitKey
} from "@tikdd/routing-health";
import Redis from "ioredis";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:16379";
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const key: ProviderCircuitKey = {
  providerId: `health-verification-${suffix}`,
  platform: "x",
  region: "global"
};
const policy = CircuitPolicySchema.parse({
  version: "docker-verification-v1",
  observationWindowMs: 60_000,
  minimumDistinctTasks: 3,
  thresholds: {
    integrity: { minimumFailures: 3, openRate: 1 },
    accessFriction: { minimumFailures: 3, openRate: 1 },
    availability: { minimumFailures: 2, openRate: 0.6 }
  },
  baseCooldownMs: 1_000,
  maximumCooldownMs: 4_000,
  recoverySuccesses: 1,
  snapshotTtlMs: 120_000,
  probeLeaseMs: 5_000,
  aggregationLeaseMs: 5_000
});
const pool = createDatabasePool(databaseUrl);
const tasks = new TaskRepository(pool);
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
const store = new RedisCircuitStore(redis);
const taskIds: string[] = [];

function makeTaskId(): string {
  return `tsk_${randomUUID().replaceAll("-", "")}`;
}

async function recordAttempt(
  status: "succeeded" | "failed",
  startedAt: Date
): Promise<void> {
  const taskId = makeTaskId();
  taskIds.push(taskId);
  await tasks.create({
    id: taskId,
    platform: "x",
    canonicalUrl: `https://x.com/health-verification/status/${taskIds.length}`,
    expiresAt: new Date(startedAt.getTime() + 60 * 60 * 1_000)
  });
  const attempt: ProviderAttempt = {
    ...key,
    providerKind: "site-adapter",
    priority: 900,
    routeScore: 900_000,
    status,
    failureCode: status === "failed" ? "provider_timeout" : null,
    retryable: status === "failed" ? true : null,
    fallbackAllowed: status === "failed" ? true : null,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date(startedAt.getTime() + 5).toISOString(),
    durationMs: 5
  };
  await tasks.recordProviderAttempts(taskId, [attempt]);
}

const filteredSource = {
  async listProviderHealthObservations(since: Date) {
    return (await tasks.listProviderHealthObservations(since)).filter(
      (observation) =>
        observation.providerId === key.providerId &&
        observation.platform === key.platform &&
        observation.region === key.region
    );
  }
};

try {
  const scenarioNow = new Date();
  await Promise.all([
    recordAttempt("failed", new Date(scenarioNow.getTime() - 3_000)),
    recordAttempt("failed", new Date(scenarioNow.getTime() - 2_000)),
    recordAttempt("succeeded", new Date(scenarioNow.getTime() - 1_000))
  ]);
  const openedRefresh = await refreshCircuitHealth({
    source: filteredSource,
    store,
    policy,
    now: scenarioNow
  });
  assert.equal(openedRefresh.updatedCount, 1);
  const opened = await store.getSnapshot(key);
  assert.equal(opened?.state, "open");

  assert.ok(opened);
  const cooldownElapsed = {
    ...opened,
    openUntil: new Date(scenarioNow.getTime() - 1_000).toISOString()
  };
  assert.equal(
    await store.putSnapshot(cooldownElapsed, opened.revision, policy.snapshotTtlMs),
    true
  );
  const probeAt = new Date(scenarioNow.getTime() + 2_000);
  const probeResults = await Promise.all([
    store.acquireProbe(key, policy, probeAt),
    store.acquireProbe(key, policy, probeAt)
  ]);
  assert.equal(probeResults.filter(Boolean).length, 1);
  assert.equal((await store.getSnapshot(key))?.state, "half-open");

  await recordAttempt("succeeded", new Date(probeAt.getTime() + 1_000));
  const recoveredRefresh = await refreshCircuitHealth({
    source: filteredSource,
    store,
    policy,
    now: new Date(probeAt.getTime() + 2_000)
  });
  assert.equal(recoveredRefresh.updatedCount, 1);
  assert.equal((await store.getSnapshot(key))?.state, "closed");

  process.stdout.write("Routing health PostgreSQL and Redis verification passed.\n");
} finally {
  if (taskIds.length > 0) {
    await pool.query("DELETE FROM resolve_tasks WHERE id = ANY($1::text[])", [taskIds]);
  }
  const storageKey = circuitStorageKey(key);
  await redis.del(storageKey, `${storageKey}:probe-lease`);
  redis.disconnect();
  await pool.end();
}
