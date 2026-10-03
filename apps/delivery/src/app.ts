import { createHash, randomUUID } from "node:crypto";
import { open, lstat, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { Readable } from "node:stream";
import cors from "@fastify/cors";
import {
  CreateDeliveryRequestSchema,
  DeliveryClientProcessingResponseSchema,
  DeliverySchema,
  type Delivery
} from "@tikdd/contracts";
import {
  assertDeliveryTargetPolicy,
  assertPublicDeliveryDns,
  createDeliveryToken,
  DeliveryTokenSchema,
  getDeliveryHostPolicy,
  hashDeliveryToken,
  type AesGcmCandidateCipher,
  type DeliveryDnsLookup
} from "@tikdd/delivery-core";
import type {
  DeliveryEvidenceContext,
  IssuedDeliveryTicket,
  RedeemedDeliveryCandidate
} from "@tikdd/persistence";
import Fastify, { LogController, type FastifyInstance } from "fastify";

export interface DeliveryRepository {
  issueDeliveryTicket(input: {
    id: string;
    taskId: string;
    formatId: string;
    tokenHash: Uint8Array;
    maximumTtlMs: number;
  }): Promise<IssuedDeliveryTicket | null>;
  redeemDeliveryTicket(tokenHash: Uint8Array): Promise<RedeemedDeliveryCandidate | null>;
  recordDeliveryRedemptionOutcome(input: {
    context: DeliveryEvidenceContext;
    result: "passed" | "candidate_expired" | "host_rejected" | "dns_rejected" | "mode_rejected" | "internal_error";
    durationMs: number;
    browserHandoff: boolean;
  }): Promise<void>;
}

export interface CreateDeliveryAppOptions {
  repository: DeliveryRepository;
  cipher: AesGcmCandidateCipher | null;
  publicBaseUrl: string;
  webOrigin: string;
  readyCheck: () => Promise<void>;
  dnsLookup?: DeliveryDnsLookup;
  ticketTtlMs?: number;
  tokenFactory?: () => string;
  ticketIdFactory?: () => string;
  fetchImpl?: typeof fetch;
  artifactRoot?: string;
}

export async function createDeliveryApp(
  options: CreateDeliveryAppOptions
): Promise<FastifyInstance> {
  const publicBaseUrl = new URL(options.publicBaseUrl);
  const ticketTtlMs = options.ticketTtlMs ?? 60_000;
  const app = Fastify({
    logger: true,
    trustProxy: false,
    logController: new LogController({ disableRequestLogging: true })
  });

  await app.register(cors, {
    origin: options.webOrigin,
    methods: ["GET", "POST"],
    allowedHeaders: ["content-type"]
  });

  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    reply.header("X-Robots-Tag", "noindex, nofollow, noarchive");
    reply.header("Referrer-Policy", "no-referrer");
  });

  app.get("/health/live", async () => ({ status: "ok", service: "delivery" }));

  app.get("/health/ready", async (_request, reply) => {
    try {
      await options.readyCheck();
      return { status: "ready", service: "delivery" };
    } catch {
      return reply.code(503).send({ status: "not-ready", service: "delivery" });
    }
  });

  app.post("/v1/deliveries", async (request, reply) => {
    const requestResult = CreateDeliveryRequestSchema.safeParse(request.body);
    if (!requestResult.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_REQUEST",
          message: "Provide a valid task and format identifier.",
          retryable: false
        }
      });
    }
    if (!options.cipher) {
      return reply.code(503).send({
        error: {
          code: "DELIVERY_ENCRYPTION_NOT_CONFIGURED",
          message: "Media delivery is not configured.",
          retryable: false
        }
      });
    }

    const token = (options.tokenFactory ?? createDeliveryToken)();
    const ticketId = `dtk_${(options.ticketIdFactory ?? (() => randomUUID().replaceAll("-", "")))()}`;
    const issued = await options.repository.issueDeliveryTicket({
      id: ticketId,
      taskId: requestResult.data.taskId,
      formatId: requestResult.data.formatId,
      tokenHash: hashDeliveryToken(token),
      maximumTtlMs: ticketTtlMs
    });
    if (!issued || !["redirect", "proxy", "temporary-object"].includes(issued.mode)) {
      return reply.code(409).send({
        error: {
          code: "DELIVERY_CANDIDATE_NOT_AVAILABLE",
          message: "The selected format is not available for secure delivery.",
          retryable: false
        }
      });
    }

    const policy = getDeliveryHostPolicy(issued.hostPolicyId);
    if (!policy || policy.providerId !== issued.providerId || !policy.modes.includes(issued.mode)) {
      return reply.code(409).send({
        error: {
          code: "DELIVERY_CANDIDATE_NOT_AVAILABLE",
          message: "The selected format is not available for secure delivery.",
          retryable: false
        }
      });
    }

    const delivery: Delivery = DeliverySchema.parse({
      id: ticketId,
      mode: issued.mode,
      url: new URL(`/d/${token}`, publicBaseUrl).toString(),
      expiresAt: issued.expiresAt,
      browserHandoff: policy.browserHandoff
    });
    return reply.code(201).send(delivery);
  });

  app.get<{ Params: { token: string } }>("/d/:token", async (request, reply) => {
    const startedAt = Date.now();
    const token = DeliveryTokenSchema.safeParse(request.params.token);
    if (!token.success || !options.cipher) {
      return reply.code(410).send({
        error: { code: "DELIVERY_EXPIRED", message: "This delivery link is no longer valid." }
      });
    }
    const redeemed = await options.repository.redeemDeliveryTicket(hashDeliveryToken(token.data));
    if (!redeemed || !["redirect", "proxy", "temporary-object"].includes(redeemed.candidate.mode)) {
      return reply.code(410).send({
        error: { code: "DELIVERY_EXPIRED", message: "This delivery link is no longer valid." }
      });
    }

    const policy = getDeliveryHostPolicy(redeemed.candidate.hostPolicyId);
    if (
      !policy ||
      policy.providerId !== redeemed.candidate.providerId ||
      !policy.modes.includes(redeemed.candidate.mode)
    ) {
      await options.repository.recordDeliveryRedemptionOutcome({
        context: redeemed.evidence, result: "mode_rejected",
        durationMs: Date.now()-startedAt, browserHandoff: false
      });
      return reply.code(502).send({
        error: {
          code: "DELIVERY_TARGET_REJECTED",
          message: "The delivery target failed its security validation."
        }
      });
    }

    let secret: ReturnType<AesGcmCandidateCipher["open"]>;
    try {
      secret = options.cipher.open(redeemed.candidate.envelope, {
        purpose: "delivery-candidate",
        candidateId: redeemed.candidate.id,
        taskId: redeemed.taskId,
        formatId: redeemed.candidate.formatId
      });
    } catch {
      await options.repository.recordDeliveryRedemptionOutcome({
        context: redeemed.evidence, result: "host_rejected",
        durationMs: Date.now()-startedAt, browserHandoff: false
      });
      return reply.code(502).send({
        error: {
          code: "DELIVERY_TARGET_REJECTED",
          message: "The delivery target failed its security validation."
        }
      });
    }
    if (secret.kind === "artifact") {
      const artifactPolicy = policy.artifact;
      if (!artifactPolicy || redeemed.candidate.mode !== "temporary-object" || policy.browserHandoff !== "server-download" ||
          !artifactPolicy.allowedMimeTypes.includes(secret.artifact.mimeType) ||
          secret.artifact.sizeBytes > artifactPolicy.maximumBytes || !options.artifactRoot) {
        await options.repository.recordDeliveryRedemptionOutcome({ context: redeemed.evidence, result: "mode_rejected",
          durationMs: Date.now()-startedAt, browserHandoff: false });
        return reply.code(502).send({ error: { code: "DELIVERY_TARGET_REJECTED", message: "The temporary artifact was rejected." } });
      }
      let handle: Awaited<ReturnType<typeof open>> | null = null;
      try {
        const root = await realpath(options.artifactRoot);
        const path = resolve(root, `${secret.artifact.id}.mp4`);
        if (!path.startsWith(`${root}${sep}`)) throw new Error("Artifact path escaped its root.");
        const link = await lstat(path);
        if (!link.isFile() || link.isSymbolicLink()) throw new Error("Artifact is not a regular file.");
        handle = await open(path, "r");
        const details = await handle.stat();
        if (!details.isFile() || details.size !== secret.artifact.sizeBytes || details.size <= 0 || details.size > artifactPolicy.maximumBytes) {
          throw new Error("Artifact size mismatch.");
        }
        const hash = createHash("sha256");
        for await (const chunk of handle.createReadStream({ start: 0, autoClose: false })) hash.update(chunk as Buffer);
        if (hash.digest("hex") !== secret.artifact.sha256) throw new Error("Artifact checksum mismatch.");
        reply.header("Content-Type", secret.artifact.mimeType);
        reply.header("Content-Disposition", `attachment; filename="${secret.artifact.filename}"`);
        reply.header("Content-Length", String(details.size));
        const artifactHandle = handle;
        const evidence = redeemed.evidence;
        handle = null;
        async function* artifactBody() {
          try {
            for await (const chunk of artifactHandle.createReadStream({ start: 0, autoClose: false })) yield chunk;
            await options.repository.recordDeliveryRedemptionOutcome({ context: evidence, result: "passed",
              durationMs: Date.now()-startedAt, browserHandoff: false });
          } catch (error) {
            await options.repository.recordDeliveryRedemptionOutcome({ context: evidence, result: "internal_error",
              durationMs: Date.now()-startedAt, browserHandoff: false });
            throw error;
          } finally { await artifactHandle.close().catch(() => undefined); }
        }
        return reply.send(Readable.from(artifactBody()));
      } catch {
        await handle?.close().catch(() => undefined);
        await options.repository.recordDeliveryRedemptionOutcome({ context: redeemed.evidence, result: "internal_error",
          durationMs: Date.now()-startedAt, browserHandoff: false });
        return reply.code(502).send({ error: { code: "DELIVERY_ARTIFACT_UNAVAILABLE", message: "The temporary media file is unavailable." } });
      }
    }
    if (secret.kind === "processing") {
      if (policy.browserHandoff !== "client-process") {
        return reply.code(502).send({
          error: { code: "DELIVERY_TARGET_REJECTED", message: "The delivery processing plan was rejected." }
        });
      }
      try {
        const hosts = new Set<string>();
        for (const input of secret.processing.inputs) {
          const target = assertDeliveryTargetPolicy({
            providerId: redeemed.candidate.providerId,
            mode: redeemed.candidate.mode,
            hostPolicyId: redeemed.candidate.hostPolicyId,
            targetUrl: input.url
          });
          hosts.add(target.hostname);
        }
        await Promise.all([...hosts].map((host) => assertPublicDeliveryDns(host, options.dnsLookup)));
      } catch {
        await options.repository.recordDeliveryRedemptionOutcome({
          context: redeemed.evidence, result: "host_rejected",
          durationMs: Date.now()-startedAt, browserHandoff: false
        });
        return reply.code(502).send({
          error: { code: "DELIVERY_TARGET_REJECTED", message: "The delivery processing plan was rejected." }
        });
      }
      await options.repository.recordDeliveryRedemptionOutcome({
        context: redeemed.evidence, result: "passed",
        durationMs: Date.now()-startedAt, browserHandoff: true
      });
      return reply.send(DeliveryClientProcessingResponseSchema.parse({
        id: redeemed.evidence.ticketId,
        expiresAt: redeemed.candidate.expiresAt,
        processing: secret.processing
      }));
    }

    let target: URL;
    try {
      if (Object.keys(secret.secretHeaders).length > 0 && policy.browserHandoff !== "server-download") {
        throw new Error("Browser delivery cannot use server-held headers.");
      }
      target = assertDeliveryTargetPolicy({
        providerId: redeemed.candidate.providerId,
        mode: redeemed.candidate.mode,
        hostPolicyId: redeemed.candidate.hostPolicyId,
        targetUrl: secret.targetUrl
      });
      await assertPublicDeliveryDns(target.hostname, options.dnsLookup);
    } catch {
      await options.repository.recordDeliveryRedemptionOutcome({
        context: redeemed.evidence, result: "dns_rejected",
        durationMs: Date.now()-startedAt, browserHandoff: false
      });
      return reply.code(502).send({
        error: {
          code: "DELIVERY_TARGET_REJECTED",
          message: "The delivery target failed its security validation."
        }
      });
    }
    if (policy.browserHandoff === "server-download") {
      if (!policy.relay || redeemed.candidate.mode !== "proxy") {
        return reply.code(502).send({ error: { code: "DELIVERY_TARGET_REJECTED", message: "The relay policy was rejected." } });
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), policy.relay.maximumDurationMs);
      try {
        let current = target;
        let upstream: Response | null = null;
        for (let redirects = 0; redirects <= 3; redirects += 1) {
          upstream = await (options.fetchImpl ?? fetch)(current, {
            method: "GET", redirect: "manual", signal: controller.signal, headers: secret.secretHeaders
          });
          if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
          const location = upstream.headers.get("location");
          if (!location || redirects === 3) throw new Error("Relay redirect rejected.");
          current = assertDeliveryTargetPolicy({ providerId: redeemed.candidate.providerId, mode: redeemed.candidate.mode,
            hostPolicyId: redeemed.candidate.hostPolicyId, targetUrl: new URL(location, current).toString() });
          await assertPublicDeliveryDns(current.hostname, options.dnsLookup);
        }
        if (!upstream?.ok || !upstream.body) throw new Error("Relay upstream failed.");
        const mimeType = (upstream.headers.get("content-type") ?? "").split(";", 1)[0]!.trim().toLowerCase();
        if (!policy.relay.allowedMimeTypes.includes(mimeType)) throw new Error("Relay MIME rejected.");
        const contentLength = Number.parseInt(upstream.headers.get("content-length") ?? "", 10);
        if (Number.isFinite(contentLength) && (contentLength <= 0 || contentLength > policy.relay.maximumBytes)) throw new Error("Relay size rejected.");
        const reader = upstream.body.getReader();
        const maximumBytes = policy.relay.maximumBytes;
        const evidence = redeemed.evidence;
        async function* boundedBody() {
          let total = 0;
          try {
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) break;
              total += chunk.value.byteLength;
              if (total > maximumBytes) throw new Error("Relay size limit exceeded.");
              yield Buffer.from(chunk.value);
            }
            if (total === 0) throw new Error("Relay returned an empty file.");
            if (Number.isFinite(contentLength) && total !== contentLength) throw new Error("Relay content length mismatch.");
            await options.repository.recordDeliveryRedemptionOutcome({ context: evidence, result: "passed",
              durationMs: Date.now()-startedAt, browserHandoff: false });
          } catch (error) {
            controller.abort();
            await options.repository.recordDeliveryRedemptionOutcome({ context: evidence, result: "internal_error",
              durationMs: Date.now()-startedAt, browserHandoff: false });
            throw error;
          } finally {
            clearTimeout(timer);
            reader.releaseLock();
          }
        }
        const safeFormat = redeemed.candidate.formatId.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
        reply.header("Content-Type", mimeType);
        reply.header("Content-Disposition", `attachment; filename="TikDD-${safeFormat}.mp4"`);
        if (Number.isFinite(contentLength)) reply.header("Content-Length", String(contentLength));
        return reply.send(Readable.from(boundedBody()));
      } catch {
        clearTimeout(timer);
        controller.abort();
        await options.repository.recordDeliveryRedemptionOutcome({ context: redeemed.evidence, result: "internal_error",
          durationMs: Date.now()-startedAt, browserHandoff: false });
        return reply.code(502).send({ error: { code: "DELIVERY_UPSTREAM_FAILED", message: "The media host could not complete this download." } });
      }
    }
    await options.repository.recordDeliveryRedemptionOutcome({
      context: redeemed.evidence, result: "passed",
      durationMs: Date.now()-startedAt, browserHandoff: true
    });
    return reply.redirect(target.toString(), 302);
  });

  return app;
}
