import { describe, expect, it } from "vitest";
import { deriveAlerts, deriveBetaCadenceSignal, derivePublicationSummary, routeNextStep, sortRoutes } from "../lib/console-model";
import { consoleSnapshot } from "./fixture";

describe("Admin console attention model", () => {
  it("prioritizes exact open routes and stale dependencies", () => {
    const alerts = deriveAlerts(consoleSnapshot);
    expect(alerts[0]).toMatchObject({ severity: "critical", target: "routing" });
    expect(alerts.some(({ id }) => id === "dependency:scheduler")).toBe(true);
    expect(alerts.some(({ id }) => id === "publishing")).toBe(true);
    expect(alerts.some(({ id }) => id === "manifest-disabled")).toBe(false);
  });

  it("sorts unsafe states before healthy routes and provides a non-mutating next step", () => {
    const routes = consoleSnapshot.routes.status === "ready" ? consoleSnapshot.routes.data.routes : [];
    const sorted = sortRoutes(routes);
    expect(sorted[0]?.state).toBe("open");
    expect(routeNextStep(sorted[0]!)).toContain("熔断");
    expect(routeNextStep(sorted[0]!)).toContain("不能手动关闭熔断");
  });

  it("does not invent healthy state when core resources are unavailable", () => {
    const unavailable = {
      ...consoleSnapshot,
      overview: { status: "unavailable" as const, data: null },
      routes: { status: "unavailable" as const, data: null },
      runtime: { status: "unavailable" as const, data: null }
    };
    const alerts = deriveAlerts(unavailable);
    expect(alerts.filter(({ severity }) => severity === "critical").length).toBeGreaterThanOrEqual(3);
  });

  it("uses the authoritative publication read model after a snapshot is propagated", () => {
    const controls = consoleSnapshot.controls.status === "ready" ? consoleSnapshot.controls.data : null;
    const published = {
      ...consoleSnapshot,
      controls: {
        status: "ready" as const,
        data: {
          ...controls!,
          contentManagement: { readiness: { missingCellCount: 0 } } as never,
          contentPublication: {
            blockers: [],
            propagationState: "propagated",
            draftCount: 0,
            diff: [],
            affectedPaths: [],
            currentRevision: 1,
            pendingSnapshotId: null
          } as never,
          seoTechnical: { blockerCount: 0 } as never
        }
      }
    } as typeof consoleSnapshot;

    expect(derivePublicationSummary(published)).toMatchObject({ pendingDrafts: 0, localeGaps: 0, seoBlockers: 0, diffCount: 0, currentRevision: 1 });
    expect(deriveAlerts(published).some(({ id }) => id === "publishing")).toBe(false);
  });

  it("suggests cooling only when transient failures dominate the window", () => {
    const report = consoleSnapshot.betaHealth.status === "ready" ? consoleSnapshot.betaHealth.data : null;
    expect(report).not.toBeNull();
    const bucket = {
      ...report!.totals,
      latestEventAt: report!.window.to,
      attempts: {
        ...report!.totals.attempts,
        total: 4,
        failed: 3,
        succeeded: 1,
        successRateBps: 2_500,
        failureCounts: { provider_rate_limited: 2, provider_timeout: 1 }
      }
    };
    expect(deriveBetaCadenceSignal(report!, bucket)).toMatchObject({ state: "cooldown_suggested", transientFailureCount: 3 });
  });

  it("keeps empty and old windows actionable without inventing a provider call", () => {
    const report = consoleSnapshot.betaHealth.status === "ready" ? consoleSnapshot.betaHealth.data : null;
    expect(report).not.toBeNull();
    const empty = {
      ...report!.totals,
      latestEventAt: null,
      attempts: { ...report!.totals.attempts, total: 0, failed: 0, succeeded: 0, successRateBps: null, failureCounts: {} }
    };
    expect(deriveBetaCadenceSignal(report!, empty).state).toBe("insufficient_data");
    const old = { ...empty, latestEventAt: "2026-08-10T00:00:00.000Z", attempts: { ...empty.attempts, total: 2, succeeded: 2, successRateBps: 10_000 } };
    expect(deriveBetaCadenceSignal(report!, old).state).toBe("stale");
  });
});
