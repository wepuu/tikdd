import assert from "node:assert/strict";
import { createDatabasePool } from "@tikdd/persistence";
import Redis from "ioredis";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl || !redisUrl) throw new Error("DATABASE_URL and REDIS_URL are required.");
const pool = createDatabasePool(databaseUrl);
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });

try {
  const result = await pool.query<{
    rollout_rules: string; pilot_policies: string; pilot_guards: string;
    pilot_audits: string; canary_measurements: string; provider_attempts: string;
  }>(`SELECT
    (SELECT count(*) FROM provider_rollout_rules WHERE provider_id LIKE 'verification-%')::text AS rollout_rules,
    (SELECT count(*) FROM provider_pilot_policies WHERE provider_id LIKE 'verification-%')::text AS pilot_policies,
    (SELECT count(*) FROM provider_pilot_guards WHERE provider_id LIKE 'verification-%')::text AS pilot_guards,
    (SELECT count(*) FROM provider_pilot_guard_audit WHERE provider_id LIKE 'verification-%')::text AS pilot_audits,
    (SELECT count(*) FROM provider_canary_measurements WHERE provider_id = 'verification-provider')::text AS canary_measurements,
    (SELECT count(*) FROM provider_attempts WHERE provider_id LIKE 'verification-%')::text AS provider_attempts`);
  const counts = result.rows[0];
  assert.ok(counts);
  for (const [table, count] of Object.entries(counts)) assert.equal(Number(count), 0, `${table} retained verification rows.`);

  let cursor = "0";
  const residualKeys: string[] = [];
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "tikdd:*verification*", "COUNT", 100);
    cursor = nextCursor;
    residualKeys.push(...keys);
  } while (cursor !== "0");
  assert.deepEqual(residualKeys, [], "Redis retained verification keys.");
  process.stdout.write(`${JSON.stringify({ verificationRows: 0, verificationRedisKeys: 0, cleanupVerified: true })}\n`);
} finally {
  redis.disconnect();
  await pool.end();
}
