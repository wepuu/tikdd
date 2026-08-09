import { describe, expect, it } from "vitest";
import {
  ProviderAttemptSchema,
  ProviderManifestSchema,
  RegionIdSchema
} from "../src/index";

const attempt = {
  providerId: "test-provider",
  providerKind: "site-adapter",
  platform: "x",
  region: "eu-west-1",
  priority: 900,
  routeScore: 900_100,
  status: "succeeded",
  failureCode: null,
  retryable: null,
  fallbackAllowed: null,
  startedAt: "2026-08-07T10:00:00.000Z",
  finishedAt: "2026-08-07T10:00:00.010Z",
  durationMs: 10
};

describe("provider operational contracts", () => {
  it("accepts concrete region slugs and reserves wildcard for manifests", () => {
    expect(RegionIdSchema.parse("eu-west-1")).toBe("eu-west-1");
    expect(() => RegionIdSchema.parse("*")).toThrow();

    expect(
      ProviderManifestSchema.parse({
        id: "test-provider",
        displayName: "Test provider",
        kind: "site-adapter",
        enabled: true,
        regions: ["*", "eu-west-1"],
        timeoutMs: 1_000,
        costWeight: 0,
        platforms: [{ platform: "x", priority: 900 }]
      }).regions
    ).toEqual(["*", "eu-west-1"]);
  });

  it("requires a concrete region on every provider attempt", () => {
    expect(ProviderAttemptSchema.parse(attempt).region).toBe("eu-west-1");
    expect(() => ProviderAttemptSchema.parse({ ...attempt, region: "*" })).toThrow();
    const { region: _region, ...withoutRegion } = attempt;
    expect(() => ProviderAttemptSchema.parse(withoutRegion)).toThrow();
  });
});
