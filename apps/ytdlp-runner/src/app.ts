import Fastify, { type FastifyInstance } from "fastify";
import { YtDlpArtifactRequestSchema, YtDlpRunnerRequestSchema, type YtDlpArtifactResponse, type YtDlpRunnerFailureCode } from "@tikdd/contracts";
import { detectPlatform } from "@tikdd/platform";
import {
  RUNNER_SIGNATURE_HEADER,
  RUNNER_TIMESTAMP_HEADER,
  verifyRunnerRequestSignature
} from "./auth";
import { YtDlpProcessError, type YtDlpCli } from "./cli";
import { ArtifactCapacityError } from "./artifact";
import { YtDlpAdmissionGate } from "./admission";

export interface YtDlpArtifactPreparer {
  prepare(input: ReturnType<typeof YtDlpArtifactRequestSchema.parse> & { signal?: AbortSignal }): Promise<YtDlpArtifactResponse>;
}

export interface CreateYtDlpRunnerAppOptions {
  cli: YtDlpCli;
  artifactPreparer?: YtDlpArtifactPreparer;
  hmacSecret: string;
  now?: () => number;
  youtubeAdmissionGate?: YtDlpAdmissionGate;
}

function failureCode(error: unknown, fallback: YtDlpRunnerFailureCode): YtDlpRunnerFailureCode {
  if (error instanceof YtDlpProcessError) return error.failureCode;
  if (error instanceof Error && /timed out|cancelled/i.test(error.message)) return "timeout";
  return fallback;
}

function failureStatus(code: YtDlpRunnerFailureCode): number {
  return code === "rate_limited" ? 429 : code === "capacity_unavailable" ? 409 : 422;
}

export function createYtDlpRunnerApp(options: CreateYtDlpRunnerAppOptions): FastifyInstance {
  if (options.hmacSecret.length < 32) throw new Error("Runner HMAC secret must be at least 32 characters.");
  const app = Fastify({ logger: true, bodyLimit: 4_096, trustProxy: false });
  const usedRequests = new Map<string, number>();
  const now = options.now ?? Date.now;
  const youtubeAdmissionGate = options.youtubeAdmissionGate ?? new YtDlpAdmissionGate(
    Number.parseInt(process.env.YTDLP_YOUTUBE_MIN_INTERVAL_MS ?? "15000", 10) || 15_000,
    now
  );

  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    reply.header("X-Robots-Tag", "noindex, nofollow, noarchive");
  });

  app.get("/healthz", async () => ({
    status: "ok",
    service: "ytdlp-runner",
    version: await options.cli.version()
  }));

  app.post("/internal/v1/extractions", async (request, reply) => {
    const parsed = YtDlpRunnerRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "invalid_request" } });
    const timestamp = request.headers[RUNNER_TIMESTAMP_HEADER];
    const signature = request.headers[RUNNER_SIGNATURE_HEADER];
    if (
      typeof timestamp !== "string" || typeof signature !== "string" ||
      !verifyRunnerRequestSignature({
        secret: options.hmacSecret,
        timestamp,
        signature,
        request: parsed.data,
        now: now()
      })
    ) return reply.code(401).send({ error: { code: "invalid_signature" } });
    const current = now();
    for (const [id, expiresAt] of usedRequests) if (expiresAt <= current) usedRequests.delete(id);
    if (usedRequests.has(parsed.data.requestId)) {
      return reply.code(409).send({ error: { code: "request_replayed" } });
    }
    usedRequests.set(parsed.data.requestId, current + 60_000);
    const releaseAdmission = youtubeAdmissionGate.tryAcquire(parsed.data.platform);
    if (!releaseAdmission) return reply.code(429).send({ error: { code: "rate_limited" } });
    try {
      const detected = detectPlatform(parsed.data.url);
      if (detected.platform !== parsed.data.platform) {
        return reply.code(400).send({ error: { code: "platform_mismatch" } });
      }
      return await options.cli.extract(parsed.data);
    } catch (error) {
      request.log.warn({
        event: "ytdlp_runner_failure",
        platform: parsed.data.platform,
        requestId: parsed.data.requestId,
        failure: failureCode(error, "extractor_error")
      });
      const code = failureCode(error, "extractor_error");
      return reply.code(failureStatus(code)).send({ error: { code } });
    } finally {
      releaseAdmission();
    }
  });

  app.post("/internal/v1/artifacts", async (request, reply) => {
    const parsed = YtDlpArtifactRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "invalid_request" } });
    const timestamp = request.headers[RUNNER_TIMESTAMP_HEADER];
    const signature = request.headers[RUNNER_SIGNATURE_HEADER];
    if (
      typeof timestamp !== "string" || typeof signature !== "string" ||
      !verifyRunnerRequestSignature({ secret: options.hmacSecret, timestamp, signature, request: parsed.data, now: now() })
    ) return reply.code(401).send({ error: { code: "invalid_signature" } });
    if (!options.artifactPreparer) return reply.code(503).send({ error: { code: "artifact_runtime_unavailable" } });
    const current = now();
    for (const [id, expiresAt] of usedRequests) if (expiresAt <= current) usedRequests.delete(id);
    if (usedRequests.has(parsed.data.requestId)) return reply.code(409).send({ error: { code: "request_replayed" } });
    usedRequests.set(parsed.data.requestId, current + 5 * 60_000);
    const releaseAdmission = youtubeAdmissionGate.tryAcquire(parsed.data.platform);
    if (!releaseAdmission) return reply.code(429).send({ error: { code: "rate_limited" } });
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.raw.once("aborted", abort);
    try {
      const detected = detectPlatform(parsed.data.url);
      if (detected.platform !== parsed.data.platform) return reply.code(400).send({ error: { code: "platform_mismatch" } });
      return await options.artifactPreparer.prepare({ ...parsed.data, signal: controller.signal });
    } catch (error) {
      const failure = error instanceof ArtifactCapacityError ? "capacity_unavailable" : failureCode(error, "extractor_error");
      request.log.warn({ event: "ytdlp_artifact_failure", platform: parsed.data.platform,
        requestId: parsed.data.requestId, failure });
      return reply.code(failureStatus(failure)).send({ error: { code: failure } });
    } finally {
      request.raw.removeListener("aborted", abort);
      releaseAdmission();
    }
  });
  return app;
}
