import { describe, expect, it } from "vitest";
import { verifyXGate02Static } from "./verify-x-gate-02-static.mjs";

describe("X-GATE-02 static boundaries", () => {
  it("keeps calibration isolated and default off", () => {
    expect(verifyXGate02Static()).toMatchObject({
      profile: "calibration",
      publicQueue: "resolve",
      calibrationQueue: "resolve-internal-ssstwitter-x-nl",
      liveProviderNetwork: false
    });
  });
});
