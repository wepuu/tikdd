import { describe, expect, it } from "vitest";
import {
  assessCurrentCobaltVimeoPinterestQualification,
  COBALT_VIMEO_PINTEREST_BATCH,
  COBALT_VIMEO_PINTEREST_QUALIFICATION_EVIDENCE
} from "../src";

describe("Work Item 127 Cobalt Vimeo/Pinterest qualification", () => {
  it("records the closed-gate NL evidence without making either platform eligible", () => {
    expect(COBALT_VIMEO_PINTEREST_BATCH).toEqual(["vimeo", "pinterest"]);
    expect(assessCurrentCobaltVimeoPinterestQualification()).toEqual([
      {
        providerId: "cobalt-selfhosted",
        platform: "vimeo",
        status: "no-media",
        adapterEligible: false,
        productionRouteEligible: false,
        failures: ["provider_error_envelope"]
      },
      {
        providerId: "cobalt-selfhosted",
        platform: "pinterest",
        status: "delivery-blocked",
        adapterEligible: false,
        productionRouteEligible: false,
        failures: ["provider_error_envelope", "cross_exit_unverified", "browser_save_unverified"]
      }
    ]);
  });

  it("does not contain sample URLs, media URLs, credentials or response data", () => {
    const serialized = JSON.stringify(COBALT_VIMEO_PINTEREST_QUALIFICATION_EVIDENCE);
    expect(serialized).not.toMatch(/https?:\/\/|cookie|token|nonce|signature|cdn\./i);
  });
});
