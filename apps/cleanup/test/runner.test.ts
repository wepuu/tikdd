import { describe, expect, it } from "vitest";
import { cleanupStages, emptyCleanupCounts } from "@tikdd/persistence";
import type { CleanupConfiguration } from "../src/configuration";
import { runCleanup } from "../src/runner";

const configuration: CleanupConfiguration = {
  deployment: "test",
  intervalMs: 60_000,
  batchSize: 2,
  taskHardRetentionMs: 1_000,
  statementTimeoutMs: 1_000,
  timeBudgetMs: 5_000,
  maxBatches: 12,
  leaseTtlMs: 10_000
};

describe("cleanup runner", () => {
  it("does not query PostgreSQL when another singleton owns the lease", async () => {
    const repository = {
      countEligible: async () => emptyCleanupCounts(),
      processStage: async () => 0
    };
    const result = await runCleanup({
      repository: repository as never,
      leaseSource: { acquire: async () => null },
      configuration
    });
    expect(result.stoppedReason).toBe("lease-unavailable");
    expect(result.batches).toBe(0);
  });

  it("processes stages in fixed order and stops after an empty pass", async () => {
    const calls: string[] = [];
    let pass = 0;
    const repository = {
      countEligible: async () => emptyCleanupCounts(),
      processStage: async (stage: string) => {
        calls.push(stage);
        if (stage === cleanupStages.at(-1)) pass += 1;
        return pass === 0 && stage === "deliveryTickets" ? 1 : 0;
      }
    };
    const result = await runCleanup({
      repository: repository as never,
      leaseSource: { acquire: async () => ({ release: async () => undefined }) },
      configuration
    });
    expect(calls).toEqual([...cleanupStages, ...cleanupStages]);
    expect(result.rows.deliveryTickets).toBe(1);
    expect(result.stoppedReason).toBe("complete");
  });
});
