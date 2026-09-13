import { describe, expect, it } from "vitest";
import { classifyTechnicalResponse } from "./provider-technical-preflight.mjs";

describe("technical Provider preflight classification", () => {
  it("marks ordinary HTTP success as reachable", () => {
    expect(classifyTechnicalResponse({ status: 200, challenge: false })).toEqual({ state: "reachable", failureCode: null });
  });

  it("marks challenge and server failures as blocked", () => {
    expect(classifyTechnicalResponse({ status: 403, challenge: true })).toEqual({ state: "blocked", failureCode: "access_challenge" });
    expect(classifyTechnicalResponse({ status: 503, challenge: false })).toEqual({ state: "blocked", failureCode: "upstream_unavailable" });
  });
});
