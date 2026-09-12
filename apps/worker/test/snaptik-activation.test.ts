import { describe, expect, it } from "vitest";
import { loadSnapTikActivationConfiguration } from "../src/snaptik-activation";

describe("SnapTik Monster worker activation", () => {
  it("is fail-closed by default", () => {
    expect(loadSnapTikActivationConfiguration({})).toEqual({
      enabled: false,
      termsApproved: false,
      deliveryAuditApproved: false
    });
  });

  it.each([
    [{ ENABLE_SNAPTIK_MONSTER_PROVIDER: "true" }, "SNAPTIK_MONSTER_TERMS_APPROVED"],
    [{ ENABLE_SNAPTIK_MONSTER_PROVIDER: "true", SNAPTIK_MONSTER_TERMS_APPROVED: "true" }, "SNAPTIK_MONSTER_DELIVERY_AUDIT_APPROVED"]
  ])("rejects incomplete activation %#", (environment, expected) => {
    expect(() => loadSnapTikActivationConfiguration(environment)).toThrow(expected);
  });

  it("admits registration only after both independent gates are explicit", () => {
    expect(loadSnapTikActivationConfiguration({
      ENABLE_SNAPTIK_MONSTER_PROVIDER: "true",
      SNAPTIK_MONSTER_TERMS_APPROVED: "true",
      SNAPTIK_MONSTER_DELIVERY_AUDIT_APPROVED: "true"
    }).enabled).toBe(true);
  });
});
