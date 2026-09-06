import { describe, expect, it } from "vitest";
import { loadSaveFromInsActivationConfiguration } from "../src/savefromins-activation";

describe("SaveFromIns worker activation", () => {
  it("is fail-closed by default", () => {
    expect(loadSaveFromInsActivationConfiguration({})).toEqual({
      enabled: false,
      termsApproved: false,
      deliveryAuditApproved: false,
      requestAuth: ""
    });
  });

  it.each([
    [{ ENABLE_SAVEFROMINS_PROVIDER: "true" }, "SAVEFROMINS_TERMS_APPROVED"],
    [{ ENABLE_SAVEFROMINS_PROVIDER: "true", SAVEFROMINS_TERMS_APPROVED: "true" }, "SAVEFROMINS_DELIVERY_AUDIT_APPROVED"],
    [{
      ENABLE_SAVEFROMINS_PROVIDER: "true",
      SAVEFROMINS_TERMS_APPROVED: "true",
      SAVEFROMINS_DELIVERY_AUDIT_APPROVED: "true"
    }, "SAVEFROMINS_REQUEST_AUTH"]
  ])("rejects incomplete activation %#", (environment, expected) => {
    expect(() => loadSaveFromInsActivationConfiguration(environment)).toThrow(expected);
  });

  it("admits registration only after every gate is explicit", () => {
    expect(loadSaveFromInsActivationConfiguration({
      ENABLE_SAVEFROMINS_PROVIDER: "true",
      SAVEFROMINS_TERMS_APPROVED: "true",
      SAVEFROMINS_DELIVERY_AUDIT_APPROVED: "true",
      SAVEFROMINS_REQUEST_AUTH: "fixtureauth123"
    }).enabled).toBe(true);
  });
});
