import { CleanupRepository, createDatabasePool } from "@tikdd/persistence";
import Redis from "ioredis";
import { loadCleanupConfiguration } from "./configuration";
import { RedisCleanupLease } from "./lease";
import { runCleanup } from "./runner";

export async function executeCleanup(dryRun: boolean): Promise<{
  metrics: Awaited<ReturnType<typeof runCleanup>>;
  close(): Promise<void>;
}> {
  const configuration = loadCleanupConfiguration();
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required.");
  const pool = createDatabasePool();
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true
  });
  await redis.connect();
  const metrics = await runCleanup({
    repository: new CleanupRepository(pool),
    leaseSource: new RedisCleanupLease(redis, configuration.deployment),
    configuration,
    dryRun
  });
  return {
    metrics,
    close: async () => {
      redis.disconnect();
      await pool.end();
    }
  };
}
