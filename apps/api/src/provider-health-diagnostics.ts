import { createHash, timingSafeEqual } from "node:crypto";
import type { CircuitSnapshot } from "@tikdd/routing-health";
import type { FastifyInstance } from "fastify";

export interface ProviderHealthDiagnosticStore {
  listSnapshots(): Promise<CircuitSnapshot[]>;
}

function tokenMatches(authorization: string | undefined, expectedToken: string): boolean {
  const prefix = "Bearer ";
  const providedToken = authorization?.startsWith(prefix)
    ? authorization.slice(prefix.length)
    : "";
  const expectedHash = createHash("sha256").update(expectedToken).digest();
  const providedHash = createHash("sha256").update(providedToken).digest();
  return timingSafeEqual(expectedHash, providedHash);
}

export function registerProviderHealthDiagnostics(
  app: FastifyInstance,
  options: {
    store: ProviderHealthDiagnosticStore;
    token: string | null;
  }
): void {
  if (options.token === null) {
    return;
  }
  if (options.token.length < 32) {
    throw new Error("PROVIDER_DIAGNOSTICS_TOKEN must contain at least 32 characters.");
  }

  app.get("/internal/v1/provider-health", async (request, reply) => {
    if (!tokenMatches(request.headers.authorization, options.token as string)) {
      return reply.code(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Provider diagnostics authorization is required.",
          retryable: false
        }
      });
    }

    const snapshots = await options.store.listSnapshots();
    return {
      generatedAt: new Date().toISOString(),
      circuits: snapshots.map((snapshot) => ({
        providerId: snapshot.key.providerId,
        platform: snapshot.key.platform,
        region: snapshot.key.region,
        state: snapshot.state,
        successRate: snapshot.successRate,
        latencyP95Ms: snapshot.latencyP95Ms,
        sampleCount: snapshot.sampleCount,
        counts: snapshot.counts,
        insufficientData: snapshot.insufficientData,
        reason: snapshot.reason,
        calculatedAt: snapshot.calculatedAt,
        windowStartedAt: snapshot.windowStartedAt,
        lastTransitionAt: snapshot.lastTransitionAt,
        openUntil: snapshot.openUntil,
        probeLeaseExpiresAt: snapshot.probeLeaseExpiresAt,
        policyVersion: snapshot.policyVersion,
        revision: snapshot.revision
      }))
    };
  });
}
