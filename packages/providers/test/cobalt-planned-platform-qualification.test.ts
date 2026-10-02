import { describe, expect, it } from "vitest";
import {
  assessCurrentCobaltPlannedPlatformQualification,
  COBALT_PLANNED_PLATFORM_BATCH,
  COBALT_PLANNED_PLATFORM_QUALIFICATION_EVIDENCE
} from "../src";

describe("Work Item 137 Cobalt planned-platform qualification", () => {
  it("keeps Dailymotion delivery-blocked and closes login-bound Reddit and VK samples", () => {
    expect(COBALT_PLANNED_PLATFORM_BATCH).toEqual(["dailymotion", "reddit", "vk"]);
    expect(assessCurrentCobaltPlannedPlatformQualification()).toEqual([
      {
        providerId: "cobalt-selfhosted",
        platform: "dailymotion",
        status: "delivery-blocked",
        adapterEligible: false,
        productionRouteEligible: false,
        failures: ["tunnel_boundary_unverified", "delivery_handoff_unverified", "browser_save_unverified"]
      },
      {
        providerId: "cobalt-selfhosted",
        platform: "reddit",
        status: "blocked",
        adapterEligible: false,
        productionRouteEligible: false,
        failures: ["browser_state_required"]
      },
      {
        providerId: "cobalt-selfhosted",
        platform: "vk",
        status: "blocked",
        adapterEligible: false,
        productionRouteEligible: false,
        failures: ["browser_state_required"]
      }
    ]);
  });

  it("does not retain source URLs, media URLs or credentials", () => {
    const serialized = JSON.stringify(COBALT_PLANNED_PLATFORM_QUALIFICATION_EVIDENCE);
    expect(serialized).not.toMatch(/https?:\/\/|cookie|token|nonce|signature|cdn\./i);
  });
});
