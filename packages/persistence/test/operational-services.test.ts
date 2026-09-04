import { describe, expect, it } from "vitest";
import { calculateOperationalWindow, nextConsecutiveFailures, projectOperationalStatus, type OperationalServiceStatus } from "../src/operational-services";

const base: OperationalServiceStatus = {
  service: "canary",
  deployment: "tikdd",
  runId: "run-1",
  state: "completed",
  leaseState: "released",
  lastStartedAt: "2026-09-03T12:00:00.000Z",
  lastFinishedAt: "2026-09-03T12:00:01.000Z",
  nextExpectedAt: "2026-09-03T12:15:01.000Z",
  staleAfterAt: "2026-09-03T12:20:01.000Z",
  consecutiveFailures: 0,
  lastErrorCode: null,
  sanitizedSummary: { sampleCount: 1, succeeded: 1, failed: 0 },
  updatedAt: "2026-09-03T12:00:01.000Z"
};

describe("operational service freshness", () => {
  it("returns missing and not ready without a status row", () => {
    expect(projectOperationalStatus(null)).toBeNull();
  });
  it("marks a fresh completed run ready", () => {
    expect(projectOperationalStatus(base, new Date("2026-09-03T12:10:00.000Z"))).toMatchObject({ freshness: "fresh", ready: true });
  });
  it("marks a late-but-bounded run degraded and not ready", () => {
    expect(projectOperationalStatus(base, new Date("2026-09-03T12:17:00.000Z"))).toMatchObject({ freshness: "degraded", ready: false });
  });
  it("calculates next expected and stale timestamps from the explicit window", () => {
    const window = calculateOperationalWindow(new Date("2026-09-03T12:00:00.000Z"), 300_000, 120_000);
    expect(window.nextExpectedAt.toISOString()).toBe("2026-09-03T12:05:00.000Z");
    expect(window.staleAfterAt.toISOString()).toBe("2026-09-03T12:07:00.000Z");
  });
  it("marks stale, failed, and lease-unavailable states not ready", () => {
    expect(projectOperationalStatus(base, new Date("2026-09-03T12:21:00.000Z"))).toMatchObject({ freshness: "stale", ready: false });
    expect(projectOperationalStatus({ ...base, state: "failed" }, new Date("2026-09-03T12:10:00.000Z"))).toMatchObject({ freshness: "failed", ready: false });
    expect(projectOperationalStatus({ ...base, state: "lease_unavailable", leaseState: "unavailable" }, new Date("2026-09-03T12:10:00.000Z"))).toMatchObject({ freshness: "failed", ready: false });
  });
  it("resets success and bounds consecutive failures", () => {
    expect(nextConsecutiveFailures(4, "completed")).toBe(0);
    expect(nextConsecutiveFailures(4, "failed")).toBe(5);
    expect(nextConsecutiveFailures(10, "lease_unavailable")).toBe(10);
  });
});
