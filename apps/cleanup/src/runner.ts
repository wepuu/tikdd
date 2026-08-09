import {
  cleanupStages,
  emptyCleanupCounts,
  type CleanupCounts,
  type CleanupRepository,
  type CleanupStage
} from "@tikdd/persistence";
import type { CleanupConfiguration } from "./configuration";

export interface CleanupLeaseSource {
  acquire(ttlMs: number): Promise<{ release(): Promise<void> } | null>;
}

export interface CleanupRunMetrics {
  mode: "dry-run" | "execute";
  leaseAcquired: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  batches: number;
  rows: CleanupCounts;
  errors: number;
  failedStage: CleanupStage | "lease" | "count" | null;
  stoppedReason: "complete" | "lease-unavailable" | "time-budget" | "batch-budget" | "error";
}

export async function runCleanup(input: {
  repository: CleanupRepository;
  leaseSource: CleanupLeaseSource;
  configuration: CleanupConfiguration;
  dryRun?: boolean;
  now?: () => Date;
}): Promise<CleanupRunMetrics> {
  const now = input.now ?? (() => new Date());
  const started = now();
  const mode = input.dryRun === true ? "dry-run" : "execute";
  const metrics: CleanupRunMetrics = {
    mode,
    leaseAcquired: false,
    startedAt: started.toISOString(),
    finishedAt: started.toISOString(),
    durationMs: 0,
    batches: 0,
    rows: emptyCleanupCounts(),
    errors: 0,
    failedStage: null,
    stoppedReason: "complete"
  };
  let lease: { release(): Promise<void> } | null = null;
  try {
    lease = await input.leaseSource.acquire(input.configuration.leaseTtlMs);
    if (!lease) {
      metrics.stoppedReason = "lease-unavailable";
      return metrics;
    }
    metrics.leaseAcquired = true;
    const policy = {
      batchSize: input.configuration.batchSize,
      taskHardRetentionMs: input.configuration.taskHardRetentionMs,
      statementTimeoutMs: input.configuration.statementTimeoutMs
    };
    if (mode === "dry-run") {
      try {
        metrics.rows = await input.repository.countEligible(policy);
      } catch {
        metrics.failedStage = "count";
        throw new Error("Cleanup count failed.");
      }
      return metrics;
    }

    while (metrics.batches < input.configuration.maxBatches) {
      let changedInPass = 0;
      for (const stage of cleanupStages) {
        if (now().getTime() - started.getTime() >= input.configuration.timeBudgetMs) {
          metrics.stoppedReason = "time-budget";
          return metrics;
        }
        if (metrics.batches >= input.configuration.maxBatches) {
          metrics.stoppedReason = "batch-budget";
          return metrics;
        }
        let affected: number;
        try {
          affected = await input.repository.processStage(stage, policy);
        } catch {
          metrics.failedStage = stage;
          throw new Error("Cleanup stage failed.");
        }
        metrics.rows[stage] += affected;
        metrics.batches += 1;
        changedInPass += affected;
      }
      if (changedInPass === 0) return metrics;
    }
    metrics.stoppedReason = "batch-budget";
    return metrics;
  } catch {
    metrics.errors += 1;
    metrics.failedStage ??= "lease";
    metrics.stoppedReason = "error";
    return metrics;
  } finally {
    if (lease) {
      try {
        await lease.release();
      } catch {
        metrics.errors += 1;
        metrics.failedStage = "lease";
        metrics.stoppedReason = "error";
      }
    }
    const finished = now();
    metrics.finishedAt = finished.toISOString();
    metrics.durationMs = Math.max(0, finished.getTime() - started.getTime());
  }
}
