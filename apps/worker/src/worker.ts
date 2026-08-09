import {
  RegionIdSchema,
  ResolveJobDataSchema,
  type ResolveJobData,
  type TaskError
} from "@tikdd/contracts";
import { createDatabasePool, TaskRepository } from "@tikdd/persistence";
import { detectPlatform, listPlatformDefinitions } from "@tikdd/platform";
import {
  DLPandaProvider,
  MockProvider,
  ProviderRouter,
  ProviderRoutingError,
  TwitterSaverProvider,
  type ResolverProvider
} from "@tikdd/providers";
import {
  RedisCircuitStore,
  RedisProviderRoutingHealthSource
} from "@tikdd/routing-health";
import { UnrecoverableError, Worker } from "bullmq";
import Redis from "ioredis";
import {
  createCandidateCipherFromEnvironment,
  prepareEncryptedCandidates
} from "./candidates";
import {
  loadProviderHealthConfiguration,
  startHealthRefreshLoop,
  type HealthRefreshLoop
} from "./health";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:16379";
const enableMockProvider = (process.env.ENABLE_MOCK_PROVIDER ?? "true") === "true";
const enableTwitterSaverProvider =
  (process.env.ENABLE_TWITTERSAVER_PROVIDER ?? "false") === "true";
const enableDLPandaProvider = (process.env.ENABLE_DLPANDA_PROVIDER ?? "false") === "true";
const twitterSaverTermsApproved =
  (process.env.TWITTERSAVER_TERMS_APPROVED ?? "false") === "true";
const dlPandaTermsApproved = (process.env.DLPANDA_TERMS_APPROVED ?? "false") === "true";
const concurrency = Number.parseInt(process.env.RESOLVER_CONCURRENCY ?? "4", 10);
const routeMaxAttempts = Number.parseInt(process.env.ROUTE_MAX_ATTEMPTS ?? "4", 10);
const routeTimeoutMs = Number.parseInt(process.env.ROUTE_TIMEOUT_MS ?? "30000", 10);
const workerRegion = RegionIdSchema.parse(process.env.WORKER_REGION ?? "global");
const candidateCipher = createCandidateCipherFromEnvironment();
const allowResolutionOnly = process.env.NODE_ENV !== "production";
const providerHealth = loadProviderHealthConfiguration();

if (process.env.NODE_ENV === "production" && enableMockProvider) {
  throw new Error("ENABLE_MOCK_PROVIDER must be false in production.");
}
if (enableTwitterSaverProvider && !twitterSaverTermsApproved) {
  throw new Error(
    "TWITTERSAVER_TERMS_APPROVED must be true before enabling the TwitterSaver adapter."
  );
}
if (enableDLPandaProvider && !dlPandaTermsApproved) {
  throw new Error("DLPANDA_TERMS_APPROVED must be true before enabling the DLPanda adapter.");
}

const catalogPlatforms = listPlatformDefinitions().map(({ id }) => id);
const pool = createDatabasePool();
const tasks = new TaskRepository(pool);
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
const circuitStore = new RedisCircuitStore(redis);
const providers: ResolverProvider[] = [];
if (enableTwitterSaverProvider) {
  providers.push(new TwitterSaverProvider({ enabled: true }));
}
if (enableDLPandaProvider) {
  providers.push(new DLPandaProvider({ enabled: true }));
}
if (enableMockProvider) {
  providers.push(new MockProvider(catalogPlatforms));
}
const router = new ProviderRouter(providers, {
  region: workerRegion,
  maxAttempts: routeMaxAttempts,
  ...(providerHealth.enabled && providerHealth.policy
    ? { healthSource: new RedisProviderRoutingHealthSource(circuitStore, providerHealth.policy) }
    : {})
});
let healthRefreshLoop: HealthRefreshLoop | null = null;
if (providerHealth.enabled && providerHealth.policy) {
  healthRefreshLoop = startHealthRefreshLoop({
    tasks,
    store: circuitStore,
    policy: providerHealth.policy,
    refreshIntervalMs: providerHealth.refreshIntervalMs,
    onResult: (message) => process.stdout.write(`${message}\n`),
    onError: (error) =>
      process.stderr.write(
        `Provider health refresh failed: ${error instanceof Error ? error.message : "unknown error"}\n`
      )
  });
}

const worker = new Worker<ResolveJobData>(
  "resolve",
  async (job) => {
    const data = ResolveJobDataSchema.parse(job.data);
    const detected = detectPlatform(data.sourceUrl);
    await tasks.markResolving(data.taskId);

    try {
      const routed = await router.resolve({
        sourceUrl: data.sourceUrl,
        canonicalUrl: detected.canonicalUrl,
        platform: data.platform,
        signal: AbortSignal.timeout(routeTimeoutMs)
      });

      const candidates = prepareEncryptedCandidates({
        taskId: data.taskId,
        resolution: routed.resolution,
        cipher: candidateCipher,
        allowResolutionOnly
      });
      await tasks.completeWithResolution(
        data.taskId,
        routed.resolution.result,
        candidates,
        routed.attempts
      );
      return {
        taskId: data.taskId,
        provider: routed.resolution.result.provenance.provider
      };
    } catch (error) {
      if (error instanceof ProviderRoutingError) {
        await tasks.recordProviderAttempts(data.taskId, error.attempts);
        if (!error.retryable) {
          await tasks.fail(data.taskId, {
            code: error.failureCode.toUpperCase(),
            message: error.message,
            retryable: false
          });
          throw new UnrecoverableError(error.message);
        }
      }
      throw error;
    }
  },
  {
    connection: redis,
    concurrency,
    lockDuration: 30_000
  }
);

worker.on("completed", (job) => {
  process.stdout.write(`Resolved ${job.id ?? "unknown job"}\n`);
});

worker.on("failed", (job, error) => {
  process.stderr.write(`Resolver job ${job?.id ?? "unknown"} failed: ${error.message}\n`);

  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    const taskError: TaskError = {
      code: "PROVIDER_UNAVAILABLE",
      message: "No resolver provider completed the task.",
      retryable: true
    };
    void tasks.fail(job.data.taskId, taskError);
  }
});

worker.on("error", (error) => {
  process.stderr.write(`Worker error: ${error.message}\n`);
});

const close = async (signal: string) => {
  process.stdout.write(`Worker received ${signal}; shutting down.\n`);
  healthRefreshLoop?.stop();
  await worker.close();
  redis.disconnect();
  await pool.end();
  process.exit(0);
};

process.once("SIGINT", () => void close("SIGINT"));
process.once("SIGTERM", () => void close("SIGTERM"));
