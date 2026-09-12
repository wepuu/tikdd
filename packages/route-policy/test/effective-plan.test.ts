import { describe, expect, it } from "vitest";
import { buildEffectiveRoutePlan, effectiveRouteScore, rankEffectiveRoutes, type EffectiveRouteCandidate } from "../src/index";

const candidate = (overrides: Partial<EffectiveRouteCandidate> = {}): EffectiveRouteCandidate => ({
  providerId: "primary",
  platform: "x",
  region: "nl",
  basePriority: 900,
  costWeight: 0,
  preferencePosition: 1,
  manualOrderSize: 2,
  successRateBps: 9_800,
  p95LatencyMs: 200,
  manifestEnabled: true,
  capabilityDeclared: true,
  regionEligible: true,
  deliveryModes: ["redirect"],
  productionEligible: true,
  rollout: "allowed",
  allocationBps: 10_000,
  circuitState: "closed",
  ...overrides
});

describe("effective route plan", () => {
  it("keeps manual order dominant while using the existing health score within that order", () => {
    const primary = candidate({ providerId: "primary", preferencePosition: 1, basePriority: 100 });
    const fallback = candidate({ providerId: "fallback", preferencePosition: 2, basePriority: 1_000 });
    expect(rankEffectiveRoutes([primary, fallback]).map(({ input }) => input.providerId)).toEqual(["primary", "fallback"]);
    expect(effectiveRouteScore(primary)).toBeGreaterThan(effectiveRouteScore(fallback));
  });

  it("softly deprioritizes access-friction without overriding manual order", () => {
    const healthy = candidate({ providerId: "healthy", preferencePosition: null, basePriority: 900, accessFrictionRateBps: 0 });
    const limited = candidate({ providerId: "limited", preferencePosition: null, basePriority: 900, accessFrictionRateBps: 10_000 });
    expect(effectiveRouteScore(healthy)).toBeGreaterThan(effectiveRouteScore(limited));

    const explicitlyOrdered = candidate({ providerId: "primary", preferencePosition: 1, accessFrictionRateBps: 10_000 });
    const fallback = candidate({ providerId: "fallback", preferencePosition: 2, basePriority: 1_000, accessFrictionRateBps: 0 });
    expect(rankEffectiveRoutes([explicitlyOrdered, fallback]).map(({ input }) => input.providerId)).toEqual(["primary", "fallback"]);
  });

  it("reports bounded exclusions and a maximum attempt order", () => {
    const plan = buildEffectiveRoutePlan([
      candidate({ providerId: "primary" }),
      candidate({ providerId: "fallback", preferencePosition: 2 }),
      candidate({ providerId: "disabled", manifestEnabled: false, preferencePosition: null }),
      candidate({ providerId: "open", circuitState: "open", preferencePosition: null })
    ], { platform: "x", region: "nl", orderedProviderIds: ["primary", "fallback", "disabled", "unknown"], maxAttempts: 1 });

    expect(plan.attemptProviderIds).toEqual(["primary"]);
    expect(plan.manualOrder).toEqual({ valid: false, configuredCount: 4, unknownProviderCount: 1 });
    expect(plan.entries.find(({ providerId }) => providerId === "disabled")).toMatchObject({ exclusionReason: "manifest_disabled" });
    expect(plan.entries.find(({ providerId }) => providerId === "open")).toMatchObject({ exclusionReason: "circuit_open" });
    expect(plan.entries.find(({ providerId }) => providerId === "fallback")).toMatchObject({ exclusionReason: "max_attempts" });
  });

  it("fails closed for missing delivery, rollout, and region eligibility", () => {
    const plan = buildEffectiveRoutePlan([
      candidate({ providerId: "fixture", deliveryModes: [], productionEligible: false }),
      candidate({ providerId: "denied", rollout: "denied" }),
      candidate({ providerId: "stale", rollout: "unavailable" }),
      candidate({ providerId: "wrong-region", regionEligible: false })
    ], { platform: "instagram", region: "nl" });
    expect(plan.attemptProviderIds).toEqual([]);
    expect(plan.entries.map(({ exclusionReason }) => exclusionReason)).toEqual([
      "no_delivery_mode", "rollout_denied", "rollout_unavailable", "region_ineligible"
    ]);
  });
});
