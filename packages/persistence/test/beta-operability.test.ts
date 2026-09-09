import { describe, expect, it } from "vitest";
import { aggregateBetaHealth } from "../src/beta-operability";

const window = {
  from: "2026-09-09T00:00:00.000Z",
  to: "2026-09-10T00:00:00.000Z",
  hours: 24
};

describe("beta operability aggregation", () => {
  it("returns platform and total aggregates without identifiers or provider details", () => {
    const report = aggregateBetaHealth({
      taskStatuses: [
        { platform: "x", status: "succeeded", count: 2, latestAt: "2026-09-09T12:00:00.000Z" },
        { platform: "instagram", status: "failed", count: 1, latestAt: "2026-09-09T12:01:00.000Z" },
        { platform: "instagram", status: "resolving", count: 1, latestAt: "2026-09-09T12:02:00.000Z" }
      ],
      taskFailures: [{ platform: "instagram", failureCode: "provider_timeout", count: 1 }],
      attempts: [
        { platform: "x", status: "succeeded", failureCode: null, count: 2, latestAt: "2026-09-09T12:00:00.000Z" },
        { platform: "instagram", status: "failed", failureCode: "provider_timeout", count: 1, latestAt: "2026-09-09T12:01:00.000Z" }
      ],
      deliveries: [
        { platform: "x", resultClass: "redirect_issued", count: 2, latestAt: "2026-09-09T12:03:00.000Z" },
        { platform: "instagram", resultClass: "host_rejected", count: 1, latestAt: "2026-09-09T12:04:00.000Z" }
      ]
    }, window, ["x", "instagram"], "2026-09-10T00:00:00.000Z");

    expect(report.totals.tasks).toMatchObject({ total: 4, succeeded: 2, failed: 1, active: 1 });
    expect(report.totals.attempts).toMatchObject({ total: 3, succeeded: 2, failed: 1, successRate: 0.6667 });
    expect(report.totals.deliveries).toMatchObject({ total: 3, succeeded: 2, failed: 1, successRate: 0.6667 });
    expect(report.byPlatform.instagram.tasks.failureCounts).toEqual({ provider_timeout: 1 });
    expect(report.latestEventAt).toBe("2026-09-09T12:04:00.000Z");

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("taskId");
    expect(serialized).not.toContain("providerId");
    expect(serialized).not.toContain("canonicalUrl");
  });

  it("normalizes invalid counts and ignores unselected platforms", () => {
    const report = aggregateBetaHealth({
      taskStatuses: [
        { platform: "x", status: "failed", count: -4, latestAt: null },
        { platform: "tiktok", status: "succeeded", count: 10, latestAt: "2026-09-09T01:00:00.000Z" }
      ],
      taskFailures: [],
      attempts: [],
      deliveries: []
    }, window, ["x"]);

    expect(report.platforms).toEqual(["x"]);
    expect(report.totals.tasks.total).toBe(0);
    expect(report.byPlatform.x.tasks.total).toBe(0);
    expect(report.latestEventAt).toBeNull();
  });
});
