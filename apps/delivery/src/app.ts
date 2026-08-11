import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import {
  CreateDeliveryRequestSchema,
  DeliverySchema,
  type Delivery
} from "@tikdd/contracts";
import {
  assertDeliveryTargetPolicy,
  assertPublicDeliveryDns,
  createDeliveryToken,
  DeliveryTokenSchema,
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
    if (!issued || issued.mode !== "redirect") {
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
      expiresAt: issued.expiresAt
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
    if (!redeemed || redeemed.candidate.mode !== "redirect") {
      return reply.code(410).send({
        error: { code: "DELIVERY_EXPIRED", message: "This delivery link is no longer valid." }
      });
    }

    let target: URL;
    try {
      const secret = options.cipher.open(redeemed.candidate.envelope, {
        purpose: "delivery-candidate",
        candidateId: redeemed.candidate.id,
        taskId: redeemed.taskId,
        formatId: redeemed.candidate.formatId
      });
      if (Object.keys(secret.secretHeaders).length > 0) {
        throw new Error("Redirect delivery cannot use server-held headers.");
      }
      target = assertDeliveryTargetPolicy({
        providerId: redeemed.candidate.providerId,
        mode: redeemed.candidate.mode,
        hostPolicyId: redeemed.candidate.hostPolicyId,
        targetUrl: secret.targetUrl
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
    try {
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
    await options.repository.recordDeliveryRedemptionOutcome({
      context: redeemed.evidence, result: "passed",
      durationMs: Date.now()-startedAt, browserHandoff: true
    });
    return reply.redirect(target.toString(), 302);
  });

  return app;
}
