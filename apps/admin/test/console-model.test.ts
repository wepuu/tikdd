import { describe, expect, it } from "vitest";
import { deriveAlerts, routeNextStep, sortRoutes } from "../lib/console-model";
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
});
