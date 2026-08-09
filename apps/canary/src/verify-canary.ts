import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CleanupRepository, OperationalDiagnosticsRepository, createDatabasePool } from "@tikdd/persistence";
import Redis from "ioredis";
import { RedisCanaryLease } from "./lease";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl || !redisUrl) throw new Error("DATABASE_URL and REDIS_URL are required.");
const pool = createDatabasePool(databaseUrl);
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
const repository = new OperationalDiagnosticsRepository(pool);
const cleanup = new CleanupRepository(pool);
const freshRunId = randomUUID();
const expiredRunId = randomUUID();
const deployment = `verify-${randomUUID().slice(0, 8)}`;
const lease = new RedisCanaryLease(redis, deployment);

try {
  const now = Date.now();
  await repository.recordCanaryMeasurement({
    runId: freshRunId, canaryId: "verification-x", providerId: "verification-provider",
    platform: "x", region: "canary-global", status: "succeeded", failureCode: null,
    durationMs: 250, formatCount: 3, linkLifetimeMs: 60000, attemptCount: 2,
    recordedAt: new Date(now - 1000), expiresAt: new Date(now + 60000)
  });
  await repository.recordCanaryMeasurement({
    runId: expiredRunId, canaryId: "verification-x", providerId: "verification-provider",
    platform: "x", region: "canary-global", status: "failed", failureCode: "provider_timeout",
    durationMs: 1000, formatCount: null, linkLifetimeMs: null, attemptCount: 1,
    recordedAt: new Date(now - 172800000), expiresAt: new Date(now - 86400000)
  });
  const health = await repository.listCanaryHealth(new Date(now - 604800000));
  const summary = health.find((item) => item.canaryId === "verification-x" && item.providerId === "verification-provider");
  assert.equal(summary?.sampleCount, 1);
  assert.equal(summary?.averageFallbackDepth, 1);
  assert.equal(summary?.minimumLinkLifetimeMs, 60000);

  assert.equal(await redis.set(lease.storageKey(), "contender", "PX", 10000, "NX"), "OK");
  assert.equal(await lease.acquire(10000), null);
  await redis.del(lease.storageKey());
  const owned = await lease.acquire(10000);
  assert.ok(owned);
  await owned.release();
  assert.equal(await redis.exists(lease.storageKey()), 0);

  const removed = await cleanup.processStage("canaryMeasurements", {
    batchSize: 10, taskHardRetentionMs: 86400000, statementTimeoutMs: 2000
  });
  assert.ok(removed >= 1);
  const rows = await pool.query(
    "SELECT count(*)::int AS count FROM provider_canary_measurements WHERE run_id = ANY($1::uuid[])",
    [[freshRunId, expiredRunId]]
  );
  assert.equal(rows.rows[0]?.count, 1);
  process.stdout.write(`${JSON.stringify({ sanitizedPersistence: true, singletonLease: true, expiryCleanup: true, sampleCount: summary.sampleCount })}\n`);
} finally {
  await pool.query("DELETE FROM provider_canary_measurements WHERE run_id = ANY($1::uuid[])", [[freshRunId, expiredRunId]]).catch(() => undefined);
  await redis.del(lease.storageKey()).catch(() => undefined);
  redis.disconnect();
  await pool.end();
}
