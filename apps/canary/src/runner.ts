import { randomUUID } from "node:crypto";
import type { Platform, ProviderFailureCode } from "@tikdd/contracts";
import type { OperationalDiagnosticsRepository } from "@tikdd/persistence";
import { detectPlatform } from "@tikdd/platform";
import { ProviderRoutingError, type ProviderRouter } from "@tikdd/providers";
import type { CanarySchedulerConfiguration } from "./configuration";

export interface CanaryDefinition {
  id: string;
  provider: string;
  platform: Platform;
  url: string;
}

export interface CanaryRunSummary {
  runId: string;
  leaseAcquired: boolean;
  sampleCount: number;
  succeeded: number;
  failed: number;
  durationMs: number;
  errorCount: number;
}

export async function runCanaries(input: {
  definitions: readonly CanaryDefinition[];
  router: ProviderRouter;
  routerForProvider?: (providerId: string) => ProviderRouter | null;
  repository: OperationalDiagnosticsRepository;
  leaseSource: { acquire(ttlMs: number): Promise<{ release(): Promise<void> } | null> };
  configuration: CanarySchedulerConfiguration;
  now?: () => Date;
}): Promise<CanaryRunSummary> {
  const now = input.now ?? (() => new Date());
  const startedAt = now();
  const runId = randomUUID();
  const summary: CanaryRunSummary = {
    runId,
    leaseAcquired: false,
    sampleCount: 0,
    succeeded: 0,
    failed: 0,
    durationMs: 0,
    errorCount: 0
  };
  let lease: { release(): Promise<void> } | null = null;
  try {
    lease = await input.leaseSource.acquire(input.configuration.leaseTtlMs);
    if (!lease) return summary;
    summary.leaseAcquired = true;
    const deadline = AbortSignal.timeout(input.configuration.runTimeoutMs);
    for (const definition of input.definitions) {
      if (deadline.aborted) break;
      const measurementStartedAt = now();
      let providerId = definition.provider;
      let failureCode: ProviderFailureCode | null = null;
      let formatCount: number | null = null;
      let linkLifetimeMs: number | null = null;
      let attemptCount = 0;
      let status: "succeeded" | "failed" = "failed";
      try {
        const router = input.routerForProvider?.(definition.provider) ?? input.router;
        if (!router) throw new Error("The requested canary Provider is unavailable.");
        const detected = detectPlatform(definition.url);
        if (detected.platform !== definition.platform) throw new Error("Canary platform mismatch.");
        const routed = await router.resolve({
          taskId: `tsk_${randomUUID().replaceAll("-", "")}`,
          sourceUrl: definition.url,
          canonicalUrl: detected.canonicalUrl,
          platform: detected.platform,
          signal: deadline
        });
        attemptCount = routed.attempts.length;
        providerId = routed.resolution.result.provenance.provider;
        formatCount = routed.resolution.result.formats.length;
        const lifetimes = routed.resolution.candidates.map((candidate) =>
          Math.max(0, new Date(candidate.expiresAt).getTime() - now().getTime())
        );
        linkLifetimeMs = lifetimes.length > 0 ? Math.min(...lifetimes) : null;
        status = "succeeded";
      } catch (error) {
        if (error instanceof ProviderRoutingError) {
          attemptCount = error.attempts.length;
          providerId = error.attempts.at(-1)?.providerId ?? providerId;
          failureCode = error.failureCode;
        } else {
          failureCode = "internal_error";
        }
      }
      const recordedAt = now();
      await input.repository.recordCanaryMeasurement({
        runId,
        canaryId: definition.id,
        providerId,
        platform: definition.platform,
        region: input.configuration.region,
        status,
        failureCode,
        durationMs: Math.max(0, recordedAt.getTime() - measurementStartedAt.getTime()),
        formatCount,
        linkLifetimeMs,
        attemptCount,
        recordedAt,
        expiresAt: new Date(recordedAt.getTime() + input.configuration.measurementRetentionMs)
      });
      summary.sampleCount += 1;
      summary[status] += 1;
    }
  } catch {
    summary.errorCount += 1;
  } finally {
    if (lease) await lease.release().catch(() => { summary.errorCount += 1; });
    summary.durationMs = Math.max(0, now().getTime() - startedAt.getTime());
  }
  return summary;
}
