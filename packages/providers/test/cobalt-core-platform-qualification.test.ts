import { describe, expect, it } from "vitest";
import {
  assessCurrentCobaltCorePlatformQualification,
  COBALT_CORE_PLATFORM_BATCH,
  COBALT_CORE_PLATFORM_QUALIFICATION_EVIDENCE
} from "../src";

describe("Work Item 128 Cobalt core-platform qualification", () => {
  it("keeps the four-platform batch fail-closed before the runtime window", () => {
    expect(COBALT_CORE_PLATFORM_BATCH).toEqual(["x", "instagram", "tiktok", "facebook"]);
    expect(assessCurrentCobaltCorePlatformQualification()).toEqual(
      COBALT_CORE_PLATFORM_BATCH.map((platform) => ({
        providerId: "cobalt-selfhosted",
        platform,
        status: "deferred",
        adapterEligible: false,
        productionRouteEligible: false,
        failures: ["runtime_not_verified"]
      }))
    );
  });

  it("does not retain source URLs, media URLs or credentials", () => {
    const serialized = JSON.stringify(COBALT_CORE_PLATFORM_QUALIFICATION_EVIDENCE);
    expect(serialized).not.toMatch(/https?:\/\/|cookie|token|nonce|signature|cdn\./i);
  });
});
