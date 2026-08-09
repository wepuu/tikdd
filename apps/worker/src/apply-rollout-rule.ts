import { createDatabasePool, RolloutRuleRepository } from "@tikdd/persistence";
import {
  RedisRolloutStore,
  RolloutRuleDraftSchema,
  refreshRolloutSnapshot
} from "@tikdd/rollout-control";
import Redis from "ioredis";

const rawRule = process.env.ROLLOUT_RULE_JSON;
const operatorId = process.env.ROLLOUT_OPERATOR_ID;
const reason = process.env.ROLLOUT_CHANGE_REASON;
if (!rawRule || !operatorId || !reason) {
  throw new Error("ROLLOUT_RULE_JSON, ROLLOUT_OPERATOR_ID, and ROLLOUT_CHANGE_REASON are required.");
}

const parsedJson = JSON.parse(rawRule) as Record<string, unknown>;
const rule = RolloutRuleDraftSchema.parse({
  ...parsedJson,
  activatesAt: parsedJson.activatesAt ?? new Date().toISOString(),
  expiresAt: parsedJson.expiresAt ?? null
});
const expectedRevisionRaw = process.env.ROLLOUT_EXPECTED_REVISION;
let expectedRevision: number | null = null;
if (expectedRevisionRaw) {
  const parsedRevision = Number.parseInt(expectedRevisionRaw, 10);
  if (!Number.isInteger(parsedRevision) || parsedRevision < 1) {
    throw new Error("ROLLOUT_EXPECTED_REVISION must be a positive integer when provided.");
  }
  expectedRevision = parsedRevision;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:16379";
const snapshotTtlMs = Number.parseInt(process.env.PROVIDER_ROLLOUT_SNAPSHOT_TTL_MS ?? "30000", 10);
if (!Number.isInteger(snapshotTtlMs) || snapshotTtlMs < 5_000 || snapshotTtlMs > 86_400_000) {
  throw new Error("PROVIDER_ROLLOUT_SNAPSHOT_TTL_MS is outside the supported range.");
}
const pool = createDatabasePool(databaseUrl);
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
const repository = new RolloutRuleRepository(pool);
const store = new RedisRolloutStore(redis);

try {
  const persisted = await repository.applyChange({
    rule,
    operatorId,
    reason,
    expectedRevision
  });
  const snapshot = await refreshRolloutSnapshot({
    store,
    loadDurable: () => repository.loadSnapshot(),
    ttlMs: snapshotTtlMs
  });
  process.stdout.write(
    `${JSON.stringify({ ruleId: persisted.id, ruleRevision: persisted.revision, snapshotRevision: snapshot.revision })}\n`
  );
} finally {
  redis.disconnect();
  await pool.end();
}
