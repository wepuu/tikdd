import { describe, expect, it } from "vitest";
import { loadCobaltActivationConfiguration } from "../src/cobalt-activation";

describe("Cobalt activation", () => {
  it("is disabled and delivery-closed by default", () => {
    expect(loadCobaltActivationConfiguration({})).toMatchObject({
      enabled: false,
      licenseAcknowledged: false,
      deliveryAuditApproved: false,
      deliveryVerifiedPlatforms: [],
      maxConcurrency: 1
    });
  });

  it("does not treat an approved OK.ru platform as delivery-verified by itself", () => {
    expect(loadCobaltActivationConfiguration({
      COBALT_APPROVED_PLATFORMS: "odnoklassniki"
    })).toMatchObject({
      enabled: false,
      approvedPlatforms: ["odnoklassniki"],
      deliveryVerifiedPlatforms: []
    });
  });

  it("requires both explicit gates when enabled", () => {
    expect(() => loadCobaltActivationConfiguration({ ENABLE_COBALT_PROVIDER: "true" }))
      .toThrow(/COBALT_LICENSE_ACKNOWLEDGED/);
    expect(() => loadCobaltActivationConfiguration({
      ENABLE_COBALT_PROVIDER: "true",
      COBALT_LICENSE_ACKNOWLEDGED: "true"
    })).toThrow(/COBALT_DELIVERY_AUDIT_APPROVED/);
  });

  it("accepts only a subset of approved delivery platforms", () => {
    const configuration = loadCobaltActivationConfiguration({
      ENABLE_COBALT_PROVIDER: "true",
      COBALT_LICENSE_ACKNOWLEDGED: "true",
      COBALT_DELIVERY_AUDIT_APPROVED: "true",
      COBALT_APPROVED_PLATFORMS: "x,odnoklassniki",
      COBALT_DELIVERY_VERIFIED_PLATFORMS: "x"
    });
    expect(configuration.deliveryVerifiedPlatforms).toEqual(["x"]);
  });
});
