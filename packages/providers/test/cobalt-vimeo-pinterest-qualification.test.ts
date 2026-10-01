import { describe, expect, it } from "vitest";
import {
  assessCurrentCobaltVimeoPinterestQualification,
  COBALT_VIMEO_PINTEREST_BATCH,
  COBALT_VIMEO_PINTEREST_QUALIFICATION_EVIDENCE
} from "../src";

describe("Work Item 127 Cobalt Vimeo/Pinterest qualification", () => {
  it("keeps the initial closed-gate batch deferred for both platforms", () => {
    expect(COBALT_VIMEO_PINTEREST_BATCH).toEqual(["vimeo", "pinterest"]);
    expect(assessCurrentCobaltVimeoPinterestQualification()).toEqual([
      {
        providerId: "cobalt-selfhosted",
        platform: "vimeo",
        status: "deferred",
        adapterEligible: false,
        productionRouteEligible: false,
        failures: ["runtime_not_verified"]
      },
      {
        providerId: "cobalt-selfhosted",
        platform: "pinterest",
        status: "deferred",
        adapterEligible: false,
        productionRouteEligible: false,
        failures: ["runtime_not_verified"]
      }
    ]);
  });

  it("does not contain sample URLs, media URLs, credentials or response data", () => {
    const serialized = JSON.stringify(COBALT_VIMEO_PINTEREST_QUALIFICATION_EVIDENCE);
    expect(serialized).not.toMatch(/https?:\/\/|cookie|token|nonce|signature|cdn\./i);
  });
});
