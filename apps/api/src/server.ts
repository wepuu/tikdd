import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import {
  RedisAdmissionStore,
  TrustedProxyResolver,
  loadAdmissionControlConfiguration
} from "@tikdd/admission-control";
import {
  CreateResolveTaskRequestSchema,
  IdempotencyKeySchema,
  ResolveJobDataSchema,
  type ResolveJobData,
  type TaskError
} from "@tikdd/contracts";
import {
  createDatabasePool,
  TaskAdmissionRepository,
  TaskIdempotencyConflictError,
  TaskRepository
} from "@tikdd/persistence";
import {
  detectPlatform,
  listPlatformSummaries,
  UnsupportedPlatformError
} from "@tikdd/platform";
import { RedisCircuitStore } from "@tikdd/routing-health";
import { Queue } from "bullmq";
import Fastify from "fastify";
import Redis from "ioredis";
import { registerProviderHealthDiagnostics } from "./provider-health-diagnostics";
import { createTaskAdmissionHasherFromEnvironment } from "./task-admission";

const port = Number.parseInt(process.env.API_PORT ?? "4000", 10);
const taskTtlHours = Number.parseInt(process.env.TASK_TTL_HOURS ?? "24", 10);
const activeSourceTtlMs = Number.parseInt(process.env.ACTIVE_SOURCE_TTL_MS ?? "300000", 10);
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:16379";
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const providerDiagnosticsToken = process.env.PROVIDER_DIAGNOSTICS_TOKEN || null;
const admissionConfiguration = loadAdmissionControlConfiguration();

if (
  !Number.isFinite(port) ||
  !Number.isInteger(taskTtlHours) ||
  taskTtlHours < 1 ||
  taskTtlHours > 168 ||
  !Number.isInteger(activeSourceTtlMs) ||
  activeSourceTtlMs < 30_000 ||
  activeSourceTtlMs > 15 * 60_000
) {
  throw new Error("API_PORT, TASK_TTL_HOURS, and ACTIVE_SOURCE_TTL_MS are invalid.");
}

const app = Fastify({
  logger: {
    serializers: {
      req() {
        return { service: "api" };
      }
    }
  },
  trustProxy: false
});
const pool = createDatabasePool();
const tasks = new TaskRepository(pool);
const taskAdmission = new TaskAdmissionRepository(pool);
const taskAdmissionHasher = createTaskAdmissionHasherFromEnvironment();
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
const admissionStore =
  admissionConfiguration.enabled && admissionConfiguration.policy
    ? new RedisAdmissionStore(redis, admissionConfiguration.policy)
    : null;
const trustedProxyResolver = new TrustedProxyResolver(admissionConfiguration.trustedProxyCidrs);
const circuitStore = new RedisCircuitStore(redis);
const resolveQueue = new Queue<ResolveJobData>("resolve", { connection: redis });

await app.register(cors, {
  origin: webOrigin,
  methods: ["GET", "POST"],
  allowedHeaders: ["content-type", "idempotency-key"]
});

app.addHook("onSend", async (request, reply) => {
  if (request.method === "GET" && request.url === "/v1/platforms") {
    reply.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    return;
  }
  reply.header("Cache-Control", "no-store");
  reply.header("X-Robots-Tag", "noindex, nofollow, noarchive");
});

app.get("/health/live", async () => ({ status: "ok", service: "api" }));

app.get("/health/ready", async (_request, reply) => {
  try {
    await Promise.all([pool.query("SELECT 1"), redis.ping()]);
    return { status: "ready", service: "api" };
  } catch {
    return reply.code(503).send({ status: "not-ready", service: "api" });
  }
});

app.get("/v1/platforms", async () => ({
  platforms: listPlatformSummaries()
}));

registerProviderHealthDiagnostics(app, {
  store: circuitStore,
  token: providerDiagnosticsToken
});

app.post("/v1/resolve-tasks", async (request, reply) => {
  const requestResult = CreateResolveTaskRequestSchema.safeParse(request.body);

  if (!requestResult.success) {
    return reply.code(400).send({
      error: {
        code: "INVALID_REQUEST",
        message: "Provide a valid supported URL and confirm you have download rights.",
        retryable: false
      }
    });
  }

  const rawIdempotencyKey = request.headers["idempotency-key"];
  const idempotencyKeyResult =
    rawIdempotencyKey === undefined
      ? null
      : typeof rawIdempotencyKey === "string"
        ? IdempotencyKeySchema.safeParse(rawIdempotencyKey)
        : { success: false as const };
  if (idempotencyKeyResult && !idempotencyKeyResult.success) {
    return reply.code(400).send({
      error: {
        code: "INVALID_IDEMPOTENCY_KEY",
        message: "Provide a valid opaque Idempotency-Key header.",
        retryable: false
      }
    });
  }

  let detected: ReturnType<typeof detectPlatform>;
  try {
    detected = detectPlatform(requestResult.data.url);
  } catch (error) {
    const message =
      error instanceof UnsupportedPlatformError ? error.message : "The URL could not be recognized.";
    return reply.code(422).send({
      error: { code: "UNSUPPORTED_URL", message, retryable: false }
    });
  }

  const now = new Date();
  const taskId = `tsk_${randomUUID().replaceAll("-", "")}`;
  const admissionPermitId =
    idempotencyKeyResult?.success === true
      ? `adp_${Buffer.from(taskAdmissionHasher.quotaPermit(idempotencyKeyResult.data)).toString("hex")}`
      : taskId;
  const admissionReferenceId = `adr_${randomUUID().replaceAll("-", "")}`;
  const taskExpiresAt = new Date(now.getTime() + taskTtlHours * 60 * 60 * 1000);
  const activeSourceExpiresAt = new Date(
    Math.min(taskExpiresAt.getTime(), now.getTime() + activeSourceTtlMs)
  );
  if (admissionStore && admissionConfiguration.policy) {
    let clientAddress: string;
    try {
      clientAddress = trustedProxyResolver.resolve({
        socketAddress: request.raw.socket.remoteAddress,
        forwardedFor: request.headers["x-forwarded-for"]
      });
    } catch {
      return reply.code(400).send({
        error: {
          code: "INVALID_REQUEST",
          message: "The request network path could not be validated.",
          retryable: false
        }
      });
    }
    try {
      const quota = await admissionStore.admitTask({
        clientIdentityDigest: taskAdmissionHasher.clientAddress(clientAddress),
        permitId: admissionPermitId,
        referenceId: admissionReferenceId,
        permitTtlMs: Math.min(
          admissionConfiguration.policy.taskPermitTtlMs,
          taskExpiresAt.getTime() - now.getTime()
        )
      });
      if (quota.kind !== "accepted") {
        reply.header("Retry-After", String(quota.retryAfterSeconds));
        return reply.code(429).send({
          error: {
            code: quota.kind === "rate-limited" ? "RATE_LIMITED" : "CONCURRENCY_LIMITED",
            message:
              quota.kind === "rate-limited"
                ? "The anonymous request allowance is exhausted."
                : "Too many resolution tasks are currently active.",
            retryable: true
          }
        });
      }
    } catch {
      await admissionStore
        .releaseTask(admissionPermitId, admissionReferenceId)
        .catch(() => undefined);
      request.log.error("anonymous task quota admission failed");
      return reply.code(503).send({
        error: {
          code: "ADMISSION_UNAVAILABLE",
          message: "Task admission is temporarily unavailable.",
          retryable: true
        }
      });
    }
  }
  let admission: Awaited<ReturnType<TaskAdmissionRepository["admit"]>>;
  try {
    admission = await taskAdmission.admit({
      task: {
        id: taskId,
        platform: detected.platform,
        canonicalUrl: detected.canonicalUrl,
        expiresAt: taskExpiresAt
      },
      sourceFingerprint: taskAdmissionHasher.canonicalSource(
        detected.platform,
        detected.canonicalUrl
      ),
      requestFingerprint: taskAdmissionHasher.request({
        platform: detected.platform,
        canonicalUrl: detected.canonicalUrl,
        confirmedRights: true
      }),
      idempotencyKeyDigest:
        idempotencyKeyResult?.success === true
          ? taskAdmissionHasher.idempotencyKey(idempotencyKeyResult.data)
          : null,
      activeSourceExpiresAt
    });
  } catch (error) {
    await admissionStore
      ?.releaseTask(admissionPermitId, admissionReferenceId)
      .catch(() => {
        request.log.error("task quota release failed");
      });
    if (error instanceof TaskIdempotencyConflictError) {
      return reply.code(409).send({
        error: {
          code: "IDEMPOTENCY_CONFLICT",
          message: "The idempotency key was already used for a different request.",
          retryable: false
        }
      });
    }
    request.log.error("task admission failed");
    return reply.code(503).send({
      error: {
        code: "ADMISSION_UNAVAILABLE",
        message: "Task admission is temporarily unavailable.",
        retryable: true
      }
    });
  }

  if (admission.kind === "duplicate") {
    await admissionStore
      ?.releaseTask(admissionPermitId, admissionReferenceId)
      .catch(() => {
        request.log.error("duplicate task quota release failed");
      });
    reply.header("Retry-After", String(admission.retryAfterSeconds));
    return reply.code(429).send({
      error: {
        code: "DUPLICATE_IN_PROGRESS",
        message: "This link is already being processed. Try again shortly.",
        retryable: true
      }
    });
  }
  if (admission.kind === "replayed") {
    await admissionStore
      ?.releaseTask(admissionPermitId, admissionReferenceId)
      .catch(() => {
        request.log.error("replayed task quota release failed");
      });
    return reply.code(202).send(admission.task);
  }
  const task = admission.task;

  const jobData = ResolveJobDataSchema.parse({
    taskId: task.id,
    admissionPermitId,
    admissionReferenceId,
    sourceUrl: requestResult.data.url,
    platform: detected.platform
  });

  try {
    await resolveQueue.add("resolve", jobData, {
      jobId: task.id,
      attempts: 3,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: 500,
      removeOnFail: 1_000
    });
  } catch {
    const taskError: TaskError = {
      code: "QUEUE_UNAVAILABLE",
      message: "The resolver queue is temporarily unavailable.",
      retryable: true
    };
    try {
      await tasks.fail(task.id, taskError);
    } finally {
      await admissionStore
        ?.releaseTask(admissionPermitId, admissionReferenceId)
        .catch(() => {
          request.log.error("queued task quota release failed");
        });
    }
    request.log.error("resolve queue add failed");
    return reply.code(503).send({ error: taskError });
  }

  return reply.code(202).send(task);
});

app.get<{ Params: { taskId: string } }>("/v1/resolve-tasks/:taskId", async (request, reply) => {
  const task = await tasks.getById(request.params.taskId);
  if (!task) {
    return reply.code(404).send({
      error: {
        code: "TASK_NOT_FOUND",
        message: "The task does not exist or has expired.",
        retryable: false
      }
    });
  }
  return task;
});

const close = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await resolveQueue.close();
  redis.disconnect();
  await pool.end();
  process.exit(0);
};

process.once("SIGINT", () => void close("SIGINT"));
process.once("SIGTERM", () => void close("SIGTERM"));

await app.listen({ port, host: "0.0.0.0" });
