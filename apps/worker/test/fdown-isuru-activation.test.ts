import { describe, expect, it } from "vitest";
import { loadFDownIsuruActivationConfiguration } from "../src/fdown-isuru-activation";

describe("FDown Isuru worker activation", () => {
  it("is disabled and fail-closed by default", () => {
    expect(loadFDownIsuruActivationConfiguration({})).toEqual({
      enabled: false,
      termsApproved: false,
      deliveryAuditApproved: false
    });
  });

  it("requires terms approval before enablement", () => {
    expect(() => loadFDownIsuruActivationConfiguration({ ENABLE_FDOWN_ISURU_PROVIDER: "true" }))
      .toThrow(/FDOWN_ISURU_TERMS_APPROVED/);
  });

  it("requires delivery audit approval before enablement", () => {
    expect(() => loadFDownIsuruActivationConfiguration({
      ENABLE_FDOWN_ISURU_PROVIDER: "true",
      FDOWN_ISURU_TERMS_APPROVED: "true"
    })).toThrow(/FDOWN_ISURU_DELIVERY_AUDIT_APPROVED/);
  });

  it("admits enablement only after both gates are explicit", () => {
    expect(loadFDownIsuruActivationConfiguration({
      ENABLE_FDOWN_ISURU_PROVIDER: "true",
      FDOWN_ISURU_TERMS_APPROVED: "true",
      FDOWN_ISURU_DELIVERY_AUDIT_APPROVED: "true"
    }).enabled).toBe(true);
  });
});
