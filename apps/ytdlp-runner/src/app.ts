import Fastify, { type FastifyInstance } from "fastify";
import { YtDlpRunnerRequestSchema } from "@tikdd/contracts";
import { detectPlatform } from "@tikdd/platform";
import {
  RUNNER_SIGNATURE_HEADER,
  RUNNER_TIMESTAMP_HEADER,
  verifyRunnerRequestSignature
} from "./auth";
import type { YtDlpCli } from "./cli";

export interface CreateYtDlpRunnerAppOptions {
  cli: YtDlpCli;
  hmacSecret: string;
  now?: () => number;
}

export function createYtDlpRunnerApp(options: CreateYtDlpRunnerAppOptions): FastifyInstance {
  if (options.hmacSecret.length < 32) throw new Error("Runner HMAC secret must be at least 32 characters.");
  const app = Fastify({ logger: true, bodyLimit: 4_096, trustProxy: false });
  const usedRequests = new Map<string, number>();
  const now = options.now ?? Date.now;

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
        failure: error instanceof Error && /timed out|cancelled/i.test(error.message)
          ? "timeout"
          : error instanceof Error && /impersonation runtime is unavailable/i.test(error.message)
            ? "runtime_dependency_unavailable"
          : "extractor_error"
      });
      return reply.code(422).send({ error: { code: "extraction_failed" } });
    }
  });
  return app;
}
