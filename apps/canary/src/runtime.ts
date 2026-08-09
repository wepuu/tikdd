import { readFile } from "node:fs/promises";
import { RedisAdmissionStore, loadAdmissionControlConfiguration } from "@tikdd/admission-control";
import { CircuitPolicySchema } from "@tikdd/routing-health";
import { OperationalDiagnosticsRepository, RolloutRuleRepository, createDatabasePool } from "@tikdd/persistence";
import { DLPandaProvider, ProviderRouter, TwitterSaverProvider } from "@tikdd/providers";
import { RedisRolloutStore, RuntimeProviderRolloutSource } from "@tikdd/rollout-control";
import { RedisCircuitStore, RedisProviderRoutingHealthSource } from "@tikdd/routing-health";
import Redis from "ioredis";
import { z } from "zod";
import { loadCanarySchedulerConfiguration } from "./configuration";
import { RedisCanaryLease } from "./lease";
import { runCanaries } from "./runner";

const ConfigSchema = z.object({
  version: z.literal(1),
  authorization: z.object({
    assertedBy: z.string().min(1),
    assertedAt: z.iso.date(),
    scope: z.string().min(1)
  }),
  canaries: z.array(z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    provider: z.enum(["twittersaver", "dlpanda"]),
    platform: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    url: z.string().url()
  })).min(1)
});

export async function executeCanaryRun() {
  const configuration = loadCanarySchedulerConfiguration();
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!databaseUrl || !redisUrl) throw new Error("DATABASE_URL and REDIS_URL are required.");
  const healthPolicyRaw = process.env.PROVIDER_HEALTH_POLICY_JSON;
  if (!healthPolicyRaw) throw new Error("PROVIDER_HEALTH_POLICY_JSON is required.");
  const healthPolicy = CircuitPolicySchema.parse(JSON.parse(healthPolicyRaw));
  const admission = loadAdmissionControlConfiguration();
  if (!admission.policy) throw new Error("ADMISSION_CONTROL_POLICY_JSON is required.");
  const config = ConfigSchema.parse(JSON.parse(await readFile(new URL("../../../config/provider-canaries.json", import.meta.url), "utf8")));
  const pool = createDatabasePool(databaseUrl);
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: true });
  await redis.connect();
  const rolloutRules = new RolloutRuleRepository(pool);
  const rollout = new RuntimeProviderRolloutSource(
    new RedisRolloutStore(redis),
    () => rolloutRules.loadSnapshot(),
    configuration.rolloutCohortKey,
    configuration.rolloutMaximumStaleMs
  );
  const circuits = new RedisCircuitStore(redis);
  const admissionStore = new RedisAdmissionStore(redis, admission.policy);
  const router = new ProviderRouter(
    [new TwitterSaverProvider({ enabled: true }), new DLPandaProvider({ enabled: true })],
    {
      region: configuration.region,
      maxAttempts: 4,
      production: true,
      rolloutSource: rollout,
      healthSource: new RedisProviderRoutingHealthSource(circuits, healthPolicy),
      concurrencySource: { acquire: (key) => admissionStore.acquireProvider(key) }
    }
  );
  const summary = await runCanaries({
    definitions: config.canaries,
    router,
    repository: new OperationalDiagnosticsRepository(pool),
    leaseSource: new RedisCanaryLease(redis, configuration.deployment),
    configuration
  });
  return { summary, close: async () => { redis.disconnect(); await pool.end(); } };
}
