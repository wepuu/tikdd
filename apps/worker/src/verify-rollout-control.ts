import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabasePool, RolloutRuleRepository } from "@tikdd/persistence";
import {
  RedisRolloutStore,
  RuntimeProviderRolloutSource,
  refreshRolloutSnapshot,
  rolloutRedisKeys
} from "@tikdd/rollout-control";
import Redis from "ioredis";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:16379";
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const ruleId = `verification-${suffix}`;
const providerId = `verification-${suffix}`;
const ambiguousRuleA = `ambiguous-a-${suffix}`;
const ambiguousRuleB = `ambiguous-b-${suffix}`;
const ambiguousProviderId = `ambiguous-${suffix}`;
const pool = createDatabasePool(databaseUrl);
const repository = new RolloutRuleRepository(pool);
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
const store = new RedisRolloutStore(redis);
const cohortKey = Buffer.alloc(32, 11);
const taskId = `tsk_${randomUUID().replaceAll("-", "")}`;
const previousSnapshot = await redis.get(rolloutRedisKeys.snapshotKey);
const previousSnapshotTtl = await redis.pttl(rolloutRedisKeys.snapshotKey);

try {
  const enabled = await repository.applyChange({
    rule: {
      id: ruleId,
      providerId,
      platform: "x",
      region: "global",
      enabled: true,
      allocationBps: 10_000,
      activatesAt: new Date(Date.now() - 1_000).toISOString(),
      expiresAt: null
    },
    operatorId: "docker-verification",
    reason: "Verify rollout enable and emergency deny transitions.",
    expectedRevision: null
  });
  assert.equal(enabled.revision, 1);
  await refreshRolloutSnapshot({
    store,
    loadDurable: () => repository.loadSnapshot(),
    ttlMs: 30_000
  });
  const source = new RuntimeProviderRolloutSource(
    store,
    () => repository.loadSnapshot(),
    cohortKey,
    15_000
  );
  const request = {
    taskId,
    providerId,
    providerKind: "site-adapter" as const,
    platform: "x",
    region: "global"
  };
  assert.equal((await source.decide(request)).allowed, true);

  const disabled = await repository.applyChange({
    rule: {
      ...enabled,
      enabled: false,
      allocationBps: 0
    },
    operatorId: "docker-verification",
    reason: "Verify the emergency deny wins without a deployment.",
    expectedRevision: enabled.revision
  });
  assert.equal(disabled.revision, 2);
  await refreshRolloutSnapshot({
    store,
    loadDurable: () => repository.loadSnapshot(),
    ttlMs: 30_000
  });
  const snapshotRevision = (await repository.loadSnapshot()).revision;
  assert.deepEqual(await source.decide(request), {
    allowed: false,
    reason: "matching_deny",
    ruleId,
    snapshotRevision,
    bucket: null
  });

  const audit = await pool.query(
    `SELECT operator_id, reason, before_rule, after_rule
     FROM provider_rollout_rule_audit
     WHERE rule_id = $1
     ORDER BY id`,
    [ruleId]
  );
  assert.equal(audit.rowCount, 2);
  assert.equal(audit.rows[0]?.before_rule, null);
  assert.equal(audit.rows[1]?.before_rule.revision, 1);
  assert.equal(audit.rows[1]?.after_rule.revision, 2);

  await repository.applyChange({
    rule: {
      id: ambiguousRuleA,
      providerId: ambiguousProviderId,
      platform: "x",
      region: "*",
      enabled: true,
      allocationBps: 10_000,
      activatesAt: new Date(Date.now() - 1_000).toISOString(),
      expiresAt: null
    },
    operatorId: "docker-verification",
    reason: "Create the first side of an ambiguity rollback test.",
    expectedRevision: null
  });
  await assert.rejects(
    repository.applyChange({
      rule: {
        id: ambiguousRuleB,
        providerId: ambiguousProviderId,
        platform: "*",
        region: "global",
        enabled: true,
        allocationBps: 10_000,
        activatesAt: new Date(Date.now() - 1_000).toISOString(),
        expiresAt: null
      },
      operatorId: "docker-verification",
      reason: "Prove ambiguous grants roll back before commit.",
      expectedRevision: null
    }),
    /Ambiguous equally specific grants/
  );
  const rolledBack = await pool.query(
    "SELECT count(*)::int AS count FROM provider_rollout_rules WHERE rule_id = $1",
    [ambiguousRuleB]
  );
  assert.equal(rolledBack.rows[0]?.count, 0);
  process.stdout.write("Provider rollout PostgreSQL and Redis verification passed.\n");
} finally {
  const verificationRuleIds = [ruleId, ambiguousRuleA, ambiguousRuleB];
  await pool.query("DELETE FROM provider_rollout_rule_audit WHERE rule_id = ANY($1::text[])", [
    verificationRuleIds
  ]);
  await pool.query("DELETE FROM provider_rollout_rules WHERE rule_id = ANY($1::text[])", [
    verificationRuleIds
  ]);
  await redis.del(rolloutRedisKeys.snapshotKey);
  if (previousSnapshot) {
    if (previousSnapshotTtl > 0) {
      await redis.set(rolloutRedisKeys.snapshotKey, previousSnapshot, "PX", previousSnapshotTtl);
    } else {
      await redis.set(rolloutRedisKeys.snapshotKey, previousSnapshot);
    }
  }
  redis.disconnect();
  await pool.end();
}
