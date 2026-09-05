import {
  loadResolveQueueName,
  RegionIdSchema,
  ResolveJobDataSchema,
  type ResolveJobData
} from "@tikdd/contracts";
import { assertInternalStartup } from "@tikdd/deployment-preflight";
import {
  RedisAdmissionStore,
  loadAdmissionControlConfiguration
} from "@tikdd/admission-control";
import {
  createDatabasePool,
  AdminRoutePolicyRepository,
  PilotControlRepository,
  RolloutRuleRepository,
  TaskRepository
} from "@tikdd/persistence";
import { listPlatformDefinitions } from "@tikdd/platform";
import {
  DLPandaProvider,
  MockProvider,
  ProviderRouter,
  SSSTwitterProvider,
  TwitterSaverProvider,
  createSSSTwitterDiagnosticTraceFromEnvironment,
  type ResolverProvider
} from "@tikdd/providers";
import {
  RedisCircuitStore,
  RedisProviderRoutingHealthSource
} from "@tikdd/routing-health";
import { Worker } from "bullmq";
import Redis from "ioredis";
import { RedisRoutePolicyStore, RuntimeRoutePolicySource } from "@tikdd/route-policy";
import { createCandidateCipherFromEnvironment } from "./candidates";
import {
  loadProviderHealthConfiguration,
  startHealthRefreshLoop,
  type HealthRefreshLoop
} from "./health";
import {
  createRolloutRuntime,
  loadRolloutConfiguration
} from "./rollout";
import { loadSSSTwitterActivationConfiguration } from "./provider-activation";
import { handleExhaustedResolveJob, processResolveJob } from "./resolve-job-processor";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:16379";
const enableMockProvider = (process.env.ENABLE_MOCK_PROVIDER ?? "true") === "true";
const enableTwitterSaverProvider =
  (process.env.ENABLE_TWITTERSAVER_PROVIDER ?? "false") === "true";
const enableDLPandaProvider = (process.env.ENABLE_DLPANDA_PROVIDER ?? "false") === "true";
const twitterSaverTermsApproved =
  (process.env.TWITTERSAVER_TERMS_APPROVED ?? "false") === "true";
const dlPandaTermsApproved = (process.env.DLPANDA_TERMS_APPROVED ?? "false") === "true";
const ssstwitterActivation = loadSSSTwitterActivationConfiguration();
const concurrency = Number.parseInt(process.env.RESOLVER_CONCURRENCY ?? "4", 10);
const routeMaxAttempts = Number.parseInt(process.env.ROUTE_MAX_ATTEMPTS ?? "4", 10);
const routeTimeoutMs = Number.parseInt(process.env.ROUTE_TIMEOUT_MS ?? "30000", 10);
const workerRegion = RegionIdSchema.parse(process.env.WORKER_REGION ?? "global");
const candidateCipher = createCandidateCipherFromEnvironment();
const allowResolutionOnly = process.env.NODE_ENV !== "production";
const providerHealth = loadProviderHealthConfiguration();
const rolloutConfiguration = loadRolloutConfiguration();
const admissionConfiguration = loadAdmissionControlConfiguration();
const production = process.env.NODE_ENV === "production";
const ssstwitterDiagnosticTrace = createSSSTwitterDiagnosticTraceFromEnvironment({
  production,
  region: workerRegion,
  sink: (event) => process.stdout.write(`${JSON.stringify(event)}\n`)
});
const deploymentId = process.env.TIKDD_DEPLOYMENT_ID ?? (production ? "" : "tikdd");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(deploymentId)) throw new Error("TIKDD_DEPLOYMENT_ID is invalid.");
const routePolicyMaximumStaleMs = Number.parseInt(process.env.ADMIN_ROUTE_POLICY_TTL_MS ?? "60000",10);
const localStackReadinessToken = process.env.LOCAL_STACK_READINESS_TOKEN ?? null;
const resolveQueueName = loadResolveQueueName(process.env.TIKDD_RESOLVE_QUEUE_NAME);
assertInternalStartup();

if (
  localStackReadinessToken !== null &&
  !/^[a-f0-9]{32}$/.test(localStackReadinessToken)
) {
  throw new Error("LOCAL_STACK_READINESS_TOKEN must be a 32-character lowercase hex value.");
}

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
const admissionStore =
  admissionConfiguration.enabled && admissionConfiguration.policy
    ? new RedisAdmissionStore(redis, admissionConfiguration.policy)
    : null;
const circuitStore = new RedisCircuitStore(redis);
const rolloutRules = new RolloutRuleRepository(pool);
const routePolicies = new AdminRoutePolicyRepository(pool, deploymentId);
const pilotControls = new PilotControlRepository(pool);
const rolloutRuntime = await createRolloutRuntime({
  redis,
  repository: rolloutRules,
  pilotRepository: pilotControls,
  configuration: rolloutConfiguration,
  production,
  onResult: (message) => process.stdout.write(`${message}\n`),
  onError: (error) =>
    process.stderr.write(
      `Provider rollout refresh failed: ${error instanceof Error ? error.message : "unknown error"}\n`
    )
});
const routePolicySource = new RuntimeRoutePolicySource(
  new RedisRoutePolicyStore(redis),
  () => routePolicies.loadRuntimeSnapshot(deploymentId, workerRegion),
  routePolicyMaximumStaleMs
);
const providers: ResolverProvider[] = [];
if (enableTwitterSaverProvider) {
  providers.push(new TwitterSaverProvider({ enabled: true }));
}
if (enableDLPandaProvider) {
  providers.push(new DLPandaProvider({ enabled: true }));
}
if (ssstwitterActivation.enabled) {
  providers.push(new SSSTwitterProvider({
    enabled: true,
    diagnosticTrace: ssstwitterDiagnosticTrace,
    region: workerRegion
  }));
}
if (enableMockProvider) {
  providers.push(new MockProvider(catalogPlatforms));
}
const router = new ProviderRouter(providers, {
  region: workerRegion,
  maxAttempts: routeMaxAttempts,
  rolloutSource: rolloutRuntime.source,
  preferenceSource: routePolicySource,
  ...(admissionStore
    ? {
        concurrencySource: {
          acquire: (key, maximumLimitOverride) => admissionStore.acquireProvider(key, maximumLimitOverride)
        }
      }
    : {}),
  production,
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
  resolveQueueName,
  async (job) => {
    const data = ResolveJobDataSchema.parse(job.data);
    return processResolveJob(data, {
      tasks,
      router,
      routeTimeoutMs,
      candidateCipher,
      allowResolutionOnly,
      releaseAdmission: async (jobData) => {
        if (jobData.admissionPermitId && jobData.admissionReferenceId) {
          await admissionStore?.releaseTask(
            jobData.admissionPermitId,
            jobData.admissionReferenceId
          );
        }
      },
      logInternal: (event) => process.stderr.write(`${JSON.stringify(event)}\n`)
    });
  },
  {
    connection: redis,
    concurrency,
    lockDuration: 30_000
  }
);

const readinessWorker = localStackReadinessToken
  ? new Worker<{ nonce: string }>(
      `tikdd-local-readiness-${localStackReadinessToken}`,
      async (job) => {
        if (job.name !== "probe" || job.data.nonce !== localStackReadinessToken) {
          throw new Error("The local stack readiness probe is invalid.");
        }
        return { nonce: localStackReadinessToken };
      },
      { connection: redis, concurrency: 1 }
    )
  : null;

readinessWorker?.once("completed", () => {
  void readinessWorker.close().catch(() => {
    process.stderr.write("Local Worker readiness queue shutdown failed.\n");
  });
});

worker.on("completed", (job) => {
  process.stdout.write(`Resolved ${job.id ?? "unknown job"}\n`);
});

worker.on("failed", (job) => {
  process.stderr.write(`Resolver job ${job?.id ?? "unknown"} failed.\n`);
  void handleExhaustedResolveJob(
    job,
    tasks,
    async (jobData) => {
      if (jobData.admissionPermitId && jobData.admissionReferenceId) {
        await admissionStore?.releaseTask(
          jobData.admissionPermitId,
          jobData.admissionReferenceId
        );
      }
    },
    (event) => process.stderr.write(`${JSON.stringify(event)}\n`)
  ).catch(() => process.stderr.write("Terminal task failure handling failed.\n"));
});

worker.on("error", (error) => {
  process.stderr.write(`Worker error: ${error.message}\n`);
});

const close = async (signal: string) => {
  process.stdout.write(`Worker received ${signal}; shutting down.\n`);
  healthRefreshLoop?.stop();
  rolloutRuntime.stop();
  await readinessWorker?.close();
  await worker.close();
  redis.disconnect();
  await pool.end();
  process.exit(0);
};

process.once("SIGINT", () => void close("SIGINT"));
process.once("SIGTERM", () => void close("SIGTERM"));
