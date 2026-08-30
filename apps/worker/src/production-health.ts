import { createDatabasePool } from "@tikdd/persistence";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("REDIS_URL is required for Worker readiness.");

const pool = createDatabasePool();
const redis = new Redis(redisUrl, {
  connectTimeout: 2_000,
  enableOfflineQueue: false,
  lazyConnect: true,
  maxRetriesPerRequest: 1
});

try {
  await Promise.all([pool.query("SELECT 1"), redis.connect().then(() => redis.ping())]);
} finally {
  await Promise.allSettled([pool.end(), redis.quit()]);
}
