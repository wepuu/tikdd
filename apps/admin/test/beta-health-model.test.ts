import { describe, expect, it } from "vitest";
import type { AdminBetaHealth } from "@tikdd/admin-contracts";
import { visibleDownloadPlatforms } from "../lib/beta-health-model";

const emptyBucket = {
  latestEventAt: null,
  tasks: { total: 0, succeeded: 0, failed: 0, expired: 0, active: 0, successRateBps: null, failureCounts: {} },
  attempts: { total: 0, succeeded: 0, failed: 0, successRateBps: null, failureCounts: {} },
  deliveries: { total: 0, succeeded: 0, failed: 0, successRateBps: null, ticketCount: 0, handoffCount: 0, resultCounts: {} }
};

describe("download platform visibility", () => {
  it("keeps observed platforms and removes capability-only empty cards", () => {
    const report = {
      schemaVersion: "1",
      generatedAt: "2026-09-22T00:00:00.000Z",
      window: { from: "2026-09-21T00:00:00.000Z", to: "2026-09-22T00:00:00.000Z", hours: 24 },
      platforms: ["x", "douyin", "youtube"],
      latestEventAt: "2026-09-21T12:00:00.000Z",
      totals: emptyBucket,
      byPlatform: {
        x: { ...emptyBucket, latestEventAt: "2026-09-21T12:00:00.000Z", tasks: { ...emptyBucket.tasks, total: 1, succeeded: 1, successRateBps: 10_000 } },
        douyin: emptyBucket,
        youtube: { ...emptyBucket, tasks: { ...emptyBucket.tasks, total: 2, failed: 2, successRateBps: 0 } }
      }
    } satisfies AdminBetaHealth;

    expect(visibleDownloadPlatforms(report)).toEqual(["x", "youtube"]);
  });
});
