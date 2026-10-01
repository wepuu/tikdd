import { describe, expect, it } from "vitest";
import {
  assessCurrentCobaltCorePlatformQualification,
  COBALT_CORE_PLATFORM_BATCH,
  COBALT_CORE_PLATFORM_QUALIFICATION_EVIDENCE
} from "../src";

describe("Work Item 128 Cobalt core-platform qualification", () => {
  it("records the closed-gate results without making any route eligible", () => {
    expect(COBALT_CORE_PLATFORM_BATCH).toEqual(["x", "instagram", "tiktok", "facebook"]);
    expect(assessCurrentCobaltCorePlatformQualification()).toEqual(
      [
        { providerId: "cobalt-selfhosted", platform: "x", status: "delivery-blocked", adapterEligible: false, productionRouteEligible: false, failures: ["cross_exit_unverified", "browser_save_unverified"] },
        { providerId: "cobalt-selfhosted", platform: "instagram", status: "no-media", adapterEligible: false, productionRouteEligible: false, failures: ["provider_error_envelope"] },
        { providerId: "cobalt-selfhosted", platform: "tiktok", status: "proxy-only", adapterEligible: false, productionRouteEligible: false, failures: ["non_portable_result"] },
        { providerId: "cobalt-selfhosted", platform: "facebook", status: "delivery-blocked", adapterEligible: false, productionRouteEligible: false, failures: ["cross_exit_unverified", "browser_save_unverified"] }
      ]
    );
  });

  it("does not retain source URLs, media URLs or credentials", () => {
    const serialized = JSON.stringify(COBALT_CORE_PLATFORM_QUALIFICATION_EVIDENCE);
    expect(serialized).not.toMatch(/https?:\/\/|cookie|token|nonce|signature|cdn\./i);
  });
});
