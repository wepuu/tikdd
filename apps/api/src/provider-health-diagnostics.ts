import { createHash, timingSafeEqual } from "node:crypto";
import type { AttemptRouteSummary, CanaryHealthSummary, FallbackDepthSummary } from "@tikdd/persistence";
import type { ProviderManifest } from "@tikdd/providers";
import type { CircuitSnapshot } from "@tikdd/routing-health";
import type { RolloutSnapshot } from "@tikdd/rollout-control";
import type { FastifyInstance } from "fastify";

export interface ProviderHealthDiagnosticStore { listSnapshots(): Promise<CircuitSnapshot[]>; }
export interface ProviderOperationalDiagnosticStore {
  listAttemptRouteSummaries(since: Date): Promise<AttemptRouteSummary[]>;
  getFallbackDepthSummary(since: Date): Promise<FallbackDepthSummary>;
  listCanaryHealth(since: Date): Promise<CanaryHealthSummary[]>;
}

function tokenMatches(authorization: string | undefined, expectedToken: string): boolean {
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  return timingSafeEqual(
    createHash("sha256").update(expectedToken).digest(),
    createHash("sha256").update(provided).digest()
  );
}

function routeKey(providerId: string, platform: string, region: string): string {
  return `${providerId}\0${platform}\0${region}`;
}

export function registerProviderHealthDiagnostics(app: FastifyInstance, options: {
  store: ProviderHealthDiagnosticStore;
  operations: ProviderOperationalDiagnosticStore;
  rollout: { loadSnapshot(): Promise<RolloutSnapshot> };
  manifests: readonly ProviderManifest[];
  region: string;
  token: string | null;
  windowMs?: number;
}): void {
  if (options.token === null) return;
  if (options.token.length < 32) throw new Error("PROVIDER_DIAGNOSTICS_TOKEN must contain at least 32 characters.");
  const windowMs = options.windowMs ?? 24 * 60 * 60 * 1_000;

  app.get("/internal/v1/provider-health", async (request, reply) => {
    if (!tokenMatches(request.headers.authorization, options.token as string)) {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Provider diagnostics authorization is required.", retryable: false } });
    }
    const since = new Date(Date.now() - windowMs);
    const [snapshots, attempts, fallbackDepth, canaries, rollout] = await Promise.all([
      options.store.listSnapshots(),
      options.operations.listAttemptRouteSummaries(since),
      options.operations.getFallbackDepthSummary(since),
      options.operations.listCanaryHealth(since),
      options.rollout.loadSnapshot()
    ]);
    const circuits = new Map(snapshots.map((item) => [routeKey(item.key.providerId, item.key.platform, item.key.region), item]));
    const attemptMap = new Map(attempts.map((item) => [routeKey(item.providerId, item.platform, item.region), item]));
    const keys = new Set([...circuits.keys(), ...attemptMap.keys()]);
    for (const manifest of options.manifests) {
      for (const capability of manifest.platforms) keys.add(routeKey(manifest.id, capability.platform, options.region));
    }
    const manifests = new Map(options.manifests.map((item) => [item.id, item]));
    const routes = [...keys].map((key) => {
      const [providerId = "", platform = "", region = ""] = key.split("\0");
      const manifest = manifests.get(providerId);
      const capability = manifest?.platforms.find((item) => item.platform === platform);
      const circuit = circuits.get(key);
      const attempt = attemptMap.get(key);
      return {
        providerId, platform, region,
        providerKind: manifest?.kind ?? null,
        manifestEnabled: manifest?.enabled ?? null,
        staticPriority: capability?.priority ?? null,
        recentAttemptCount: attempt?.attemptCount ?? 0,
        recentFailureCounts: attempt?.failureCounts ?? {},
        circuit: circuit ? {
          state: circuit.state, successRate: circuit.successRate, latencyP95Ms: circuit.latencyP95Ms,
          sampleCount: circuit.sampleCount, counts: circuit.counts, insufficientData: circuit.insufficientData,
          reason: circuit.reason, calculatedAt: circuit.calculatedAt, lastTransitionAt: circuit.lastTransitionAt,
          openUntil: circuit.openUntil, policyVersion: circuit.policyVersion, revision: circuit.revision
        } : null
      };
    }).sort((a, b) => a.providerId.localeCompare(b.providerId) || a.platform.localeCompare(b.platform) || a.region.localeCompare(b.region));
    return {
      generatedAt: new Date().toISOString(), windowStartedAt: since.toISOString(),
      rollout: {
        revision: rollout.revision, generatedAt: rollout.generatedAt,
        rules: rollout.rules.map(({ id, providerId, platform, region, enabled, allocationBps, revision, activatesAt, expiresAt }) =>
          ({ id, providerId, platform, region, enabled, allocationBps, revision, activatesAt, expiresAt }))
      },
      fallbackDepth, routes, canaries
    };
  });
}
