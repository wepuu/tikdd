import { AdminPasswordAuthService } from "./auth";
import { buildAdminApi } from "./app";
import { loadAdminApiConfiguration } from "./config";
import { AdminReadService } from "./read-service";
import {
  AdminControlPlaneReadRepository,
  AdminContentManagementRepository,
  AdminContentPublicationRepository,
  AdminAccountRepository,
  AdminPlatformPresentationRepository,
  AdminRoutePolicyRepository,
  createDatabasePool,
  OperationalDiagnosticsRepository,
  PilotControlRepository,
  PilotEvidenceRepository,
  RolloutRuleRepository
} from "@tikdd/persistence";
import { listPlatformDefinitions } from "@tikdd/platform";
import { DLPandaProvider, SSSTwitterProvider, TwitterSaverProvider } from "@tikdd/providers";
import { RedisCircuitStore } from "@tikdd/routing-health";
import { RedisRoutePolicyStore } from "@tikdd/route-policy";
import { RedisRolloutStore } from "@tikdd/rollout-control";
import { AdminCsrfProtector } from "./csrf";
import { AdminRoutePolicyService } from "./route-policy-service";
import { AdminBoundedProbeRunner } from "./probe-runner";
import { AdminPlatformManagementService } from "./platform-management-service";
import { AdminContentManagementService } from "./content-management-service";
import { WebContentRevalidator } from "./web-content-revalidator";
import { loadAdmissionControlConfiguration,resolveProviderConcurrencyLimit } from "@tikdd/admission-control";
import { Queue } from "bullmq";
import Redis from "ioredis";

const configuration = loadAdminApiConfiguration();
const pool = createDatabasePool();
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:16379", {
  maxRetriesPerRequest: null
});
const queue = new Queue("resolve", { connection: redis });
const editorial = new AdminControlPlaneReadRepository(pool);
const operations = new OperationalDiagnosticsRepository(pool);
const evidence = new PilotEvidenceRepository(pool);
const rollout = new RolloutRuleRepository(pool);
const routePolicyWrites = new AdminRoutePolicyRepository(pool, configuration.deployment);
const guards = new PilotControlRepository(pool);
const circuits = new RedisCircuitStore(redis);
const routePolicyStore = new RedisRoutePolicyStore(redis);
const rolloutStore = new RedisRolloutStore(redis);
const providerAdapters = [
  new TwitterSaverProvider({ enabled: process.env.ENABLE_TWITTERSAVER_PROVIDER === "true" }),
  new SSSTwitterProvider({ enabled: process.env.ENABLE_SSSTWITTER_PROVIDER === "true" }),
  new DLPandaProvider({ enabled: process.env.ENABLE_DLPANDA_PROVIDER === "true" })
];
const manifests = providerAdapters.map(({manifest})=>manifest);
const admission = loadAdmissionControlConfiguration();

const reads = new AdminReadService({
  deployment: configuration.deployment,
  region: configuration.region,
  authMode: "password",
  manifests,
  platforms: listPlatformDefinitions(),
  circuits,
  rollout,
  ...(configuration.guardRequired ? { guards } : {}),
  guardRequired: configuration.guardRequired,
  guardMaximumStaleMs: configuration.guardMaximumStaleMs,
  operations,
  editorial,
  queue: {
    async getJobCounts(...types: string[]) {
      return queue.getJobCounts(...(types as Parameters<typeof queue.getJobCounts>));
    }
  },
  health: {
    async postgres() {
      await pool.query("SELECT 1");
    },
    async redis() {
      await redis.ping();
    },
    async queue() {
      await queue.getJobCounts("waiting");
    },
    async schedulerObservedAt() {
      const run = await evidence.latestEvaluatorRun();
      return typeof run?.finishedAt === "string" ? run.finishedAt : null;
    }
  },
  readTimeoutMs: configuration.readTimeoutMs,
  freshnessMs: configuration.freshnessMs
});

const routePolicies = new AdminRoutePolicyService({
  deployment: configuration.deployment,
  region: configuration.region,
  manifests,
  catalogPlatforms: listPlatformDefinitions().map(({id})=>id),
  maximumConcurrencyByProvider: {},
  maximumConcurrencyForRoute: admission.policy
    ? (providerId,platform,region)=>resolveProviderConcurrencyLimit(admission.policy!,{providerId,platform,region})
    : ()=>undefined,
  commandSecret: configuration.commandSecret,
  projectionTtlMs: configuration.routePolicyProjectionTtlMs,
  reads: editorial,
  writes: routePolicyWrites,
  routeStore: routePolicyStore,
  rolloutStore,
  rolloutRepository: rollout,
  probeRunner: new AdminBoundedProbeRunner({redis,providers:providerAdapters,operations,region:configuration.region,
    authorized:process.env.TIKDD_CANARY_AUTHORIZED==="true"})
});

const platformManagement = new AdminPlatformManagementService({
  region: configuration.region,
  commandSecret: configuration.commandSecret,
  platforms: listPlatformDefinitions(),
  manifests,
  reads,
  writes: new AdminPlatformPresentationRepository(pool)
});
const webContentRevalidator = new WebContentRevalidator({ origin: configuration.webContent.origin, secret: configuration.webContent.revalidationSecret, timeoutMs: configuration.webContent.timeoutMs });
const contentManagement = new AdminContentManagementService({
  commandSecret: configuration.commandSecret,
  deployment: configuration.deployment,
  platforms: listPlatformDefinitions(),
  writes: new AdminContentManagementRepository(pool),
  publication: new AdminContentPublicationRepository(pool),
  seoEligibility: async()=>{const routes=await reads.listRoutes();return listPlatformDefinitions().filter(platform=>platform.status==="stable"&&routes.routes.some(route=>route.tuple.platform===platform.id&&route.tuple.region===configuration.region&&route.manifestEnabled&&route.allocationBps>0&&!["open","paused","unavailable","stale"].includes(route.state))).map(platform=>platform.id);},
  revalidator: (paths,snapshotId) => webContentRevalidator.revalidate(paths,snapshotId)
});

const app = buildAdminApi({
  configuration,
  authService: new AdminPasswordAuthService(new AdminAccountRepository(pool),redis),
  reads,
  routePolicies,
  platformManagement,
  contentManagement,
  csrfProtector: new AdminCsrfProtector(configuration.csrfSecret),
  logger: true
});

const close = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await queue.close();
  redis.disconnect();
  await pool.end();
  process.exit(0);
};

process.once("SIGINT", () => void close("SIGINT"));
process.once("SIGTERM", () => void close("SIGTERM"));

await app.listen({ port: configuration.port, host: configuration.host });
