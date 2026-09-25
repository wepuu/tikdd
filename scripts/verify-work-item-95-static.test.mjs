import { describe, expect, it } from "vitest";
import { verifyWorkItem95Static } from "./verify-work-item-95-static.mjs";

describe("Work Item 95 low-traffic circuit recovery contract", () => {
  it("keeps production recovery bounded to one successful natural probe", () => {
    expect(verifyWorkItem95Static()).toEqual({
      policyVersion: "production-low-traffic-v2",
      recoverySuccesses: 1
    });
  });
});
