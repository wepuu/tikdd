import { describe, expect, it } from "vitest";
import { deriveRouteOperationsPulse } from "../lib/route-operations-model";
import { ADMIN_ROUTE_FIXTURES, ADMIN_BETA_HEALTH_FIXTURE } from "@tikdd/admin-contracts/fixtures";
import { deriveEffectiveRoutePlans } from "../lib/console-model";

describe("route operations pulse", () => {
  it("summarizes the active chain and weighted natural traffic without probing", () => {
    const primary = ADMIN_ROUTE_FIXTURES.healthy;
    const fallback = {
      ...primary,
      tuple: { ...primary.tuple, providerId: "ssstwitter" },
      providerDisplayName: "SSSTwitter",
      preferencePosition: 2,
      basePriority: 800,
      trafficShareBps: 0,
      sampleCount: 2,
      successRateBps: 5_000,
      fallbackRateBps: 1_000
    };
    const routes = [primary, fallback];
    const plans = deriveEffectiveRoutePlans(routes, []);
    const pulse = deriveRouteOperationsPulse(routes, plans, ADMIN_BETA_HEALTH_FIXTURE);
    expect(pulse).toHaveLength(1);
    expect(pulse[0]).toMatchObject({
      primaryProvider: "TwitterSaver",
      activeProviderNames: ["TwitterSaver", "SSSTwitter"],
      activeRouteCount: 2,
      sampleCount: 50,
      successRateBps: 9_536,
      fallbackRateBps: 760,
      state: "ready"
    });
  });

  it("does not turn an inactive capability into a production route", () => {
    const paused = { ...ADMIN_ROUTE_FIXTURES.healthy, allocationBps: 0, state: "paused" as const };
    const plans = deriveEffectiveRoutePlans([paused], []);
    const pulse = deriveRouteOperationsPulse([paused], plans, null);
    expect(pulse[0]).toMatchObject({ state: "blocked", activeRouteCount: 0, primaryProvider: null, beta: null });
  });

  it("keeps missing samples explicit", () => {
    const route = { ...ADMIN_ROUTE_FIXTURES.healthy, sampleCount: 0, successRateBps: null, fallbackRateBps: null, observedAt: null };
    const plans = deriveEffectiveRoutePlans([route], []);
    const pulse = deriveRouteOperationsPulse([route], plans, null);
    expect(pulse[0]).toMatchObject({ state: "no-data", sampleCount: 0, successRateBps: null, latestObservedAt: null });
  });
});
