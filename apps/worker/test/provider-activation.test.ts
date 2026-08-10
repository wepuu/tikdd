import { describe, expect, it } from "vitest";
import { loadSSSTwitterActivationConfiguration } from "../src/provider-activation";

describe("SSSTwitter worker activation", () => {
  it("is fail-closed by default", () => {
    expect(loadSSSTwitterActivationConfiguration({})).toEqual({
      enabled: false,
      termsApproved: false,
      deliveryAuditApproved: false
    });
  });

  it("refuses enablement without independent terms approval", () => {
    expect(() =>
      loadSSSTwitterActivationConfiguration({ ENABLE_SSSTWITTER_PROVIDER: "true" })
    ).toThrow(/SSSTWITTER_TERMS_APPROVED/);
  });

  it("refuses enablement until the delivery audit is approved", () => {
    expect(() =>
      loadSSSTwitterActivationConfiguration({
        ENABLE_SSSTWITTER_PROVIDER: "true",
        SSSTWITTER_TERMS_APPROVED: "true"
      })
    ).toThrow(/SSSTWITTER_DELIVERY_AUDIT_APPROVED/);
  });

  it("admits registration only after both independent gates are explicit", () => {
    expect(
      loadSSSTwitterActivationConfiguration({
        ENABLE_SSSTWITTER_PROVIDER: "true",
        SSSTWITTER_TERMS_APPROVED: "true",
        SSSTWITTER_DELIVERY_AUDIT_APPROVED: "true"
      }).enabled
    ).toBe(true);
  });
});
