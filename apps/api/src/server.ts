import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import {
  CreateResolveTaskRequestSchema,
  ResolveJobDataSchema,
  type ResolveJobData,
  type TaskError
} from "@tikdd/contracts";
import { createDatabasePool, TaskRepository } from "@tikdd/persistence";
import {
  detectPlatform,
  listPlatformSummaries,
  UnsupportedPlatformError
} from "@tikdd/platform";
import { Queue } from "bullmq";
import Fastify from "fastify";
import Redis from "ioredis";

const port = Number.parseInt(process.env.API_PORT ?? "4000", 10);
const taskTtlHours = Number.parseInt(process.env.TASK_TTL_HOURS ?? "24", 10);
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

if (!Number.isFinite(port) || !Number.isFinite(taskTtlHours)) {
  throw new Error("API_PORT and TASK_TTL_HOURS must be valid numbers.");
}

const app = Fastify({ logger: true, trustProxy: true });
const pool = createDatabasePool();
const tasks = new TaskRepository(pool);
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
const resolveQueue = new Queue<ResolveJobData>("resolve", { connection: redis });

await app.register(cors, {
  origin: webOrigin,
  methods: ["GET", "POST"],
  allowedHeaders: ["content-type"]
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
  const task = await tasks.create({
    id: taskId,
    platform: detected.platform,
    canonicalUrl: detected.canonicalUrl,
    expiresAt: new Date(now.getTime() + taskTtlHours * 60 * 60 * 1000)
  });

  const jobData = ResolveJobDataSchema.parse({
    taskId,
    sourceUrl: requestResult.data.url,
    platform: detected.platform
  });

  try {
    await resolveQueue.add("resolve", jobData, {
      jobId: taskId,
      attempts: 3,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: 500,
      removeOnFail: 1_000
    });
  } catch (error) {
    const taskError: TaskError = {
      code: "QUEUE_UNAVAILABLE",
      message: "The resolver queue is temporarily unavailable.",
      retryable: true
    };
    await tasks.fail(taskId, taskError);
    request.log.error(error);
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
