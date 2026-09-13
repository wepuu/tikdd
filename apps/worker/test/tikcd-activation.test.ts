import { describe, expect, it } from "vitest";
import { loadTikCDActivationConfiguration } from "../src/tikcd-activation";

describe("TikCD activation", () => {
  it("is fail-closed by default", () => {
    expect(loadTikCDActivationConfiguration({})).toEqual({
      enabled: false,
      termsApproved: false,
      deliveryAuditApproved: false
    });
  });

  it("requires both independent gates", () => {
    expect(() => loadTikCDActivationConfiguration({ ENABLE_TIKCD_PROVIDER: "true" })).toThrow(/TIKCD_TERMS_APPROVED/);
    expect(() => loadTikCDActivationConfiguration({ ENABLE_TIKCD_PROVIDER: "true", TIKCD_TERMS_APPROVED: "true" })).toThrow(/TIKCD_DELIVERY_AUDIT_APPROVED/);
    expect(loadTikCDActivationConfiguration({
      ENABLE_TIKCD_PROVIDER: "true",
      TIKCD_TERMS_APPROVED: "true",
      TIKCD_DELIVERY_AUDIT_APPROVED: "true"
    }).enabled).toBe(true);
  });
});
