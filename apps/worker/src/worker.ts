import {
  RegionIdSchema,
  ResolveJobDataSchema,
  type ResolveJobData,
  type TaskError
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
  ProviderRoutingError,
  SSSTwitterProvider,
  TwitterSaverProvider,
  createSSSTwitterDiagnosticTraceFromEnvironment,
  type ResolverProvider
} from "@tikdd/providers";
import {
  RedisCircuitStore,
  RedisProviderRoutingHealthSource
} from "@tikdd/routing-health";
import { UnrecoverableError, Worker } from "bullmq";
import Redis from "ioredis";
import { RedisRoutePolicyStore, RuntimeRoutePolicySource } from "@tikdd/route-policy";
import {
  createCandidateCipherFromEnvironment,
  prepareEncryptedCandidates
} from "./candidates";
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
import { ResolveJobPlatformMismatchError, verifyResolveJobPlatform } from "./platform-consistency";

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
  "resolve",
  async (job) => {
    const data = ResolveJobDataSchema.parse(job.data);
    await tasks.markResolving(data.taskId);

    try {
      const detected = verifyResolveJobPlatform(data);
      const routed = await router.resolve({
        taskId: data.taskId,
        sourceUrl: data.sourceUrl,
        canonicalUrl: detected.canonicalUrl,
        platform: detected.platform,
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
      if (data.admissionPermitId && data.admissionReferenceId) {
        await admissionStore
          ?.releaseTask(data.admissionPermitId, data.admissionReferenceId)
          .catch(() => {
            process.stderr.write("Task admission permit release failed.\n");
          });
      }
      return {
        taskId: data.taskId,
        provider: routed.resolution.result.provenance.provider
      };
    } catch (error) {
      if (error instanceof ResolveJobPlatformMismatchError) {
        await tasks.fail(data.taskId, {
          code: error.code,
          message: error.message,
          retryable: false
        });
        if (data.admissionPermitId && data.admissionReferenceId) {
          await admissionStore
            ?.releaseTask(data.admissionPermitId, data.admissionReferenceId)
            .catch(() => process.stderr.write("Task admission permit release failed.\n"));
        }
        throw new UnrecoverableError(error.message);
      }
      if (error instanceof ProviderRoutingError) {
        await tasks.recordProviderAttempts(data.taskId, error.attempts);
        if (!error.retryable) {
          await tasks.fail(data.taskId, {
            code: error.failureCode.toUpperCase(),
            message: error.message,
            retryable: false
          });
          if (data.admissionPermitId && data.admissionReferenceId) {
            await admissionStore
              ?.releaseTask(data.admissionPermitId, data.admissionReferenceId)
              .catch(() => {
                process.stderr.write("Task admission permit release failed.\n");
              });
          }
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

  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    const taskError: TaskError = {
      code: "PROVIDER_UNAVAILABLE",
      message: "No resolver provider completed the task.",
      retryable: true
    };
    void tasks
      .fail(job.data.taskId, taskError)
      .then(() =>
        job.data.admissionPermitId && job.data.admissionReferenceId
          ? admissionStore?.releaseTask(
              job.data.admissionPermitId,
              job.data.admissionReferenceId
            )
          : undefined
      )
      .catch(() => {
        process.stderr.write("Terminal task admission release failed.\n");
      });
  }
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
