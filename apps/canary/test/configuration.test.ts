import { describe, expect, it } from "vitest";
import { loadCanarySchedulerConfiguration } from "../src/configuration";

const valid = {
  TIKDD_CANARY_AUTHORIZED: "true",
  PROVIDER_ROLLOUT_ENABLED: "true",
  PROVIDER_HEALTH_ENABLED: "true",
  ADMISSION_CONTROL_ENABLED: "true",
  PROVIDER_ROLLOUT_COHORT_KEY_BASE64URL: Buffer.alloc(32, 7).toString("base64url")
};

describe("canary scheduler configuration", () => {
  it("requires all safety gates", () => {
    expect(() => loadCanarySchedulerConfiguration({})).toThrow(/authorization/i);
    expect(() => loadCanarySchedulerConfiguration({ ...valid, PROVIDER_HEALTH_ENABLED: "false" })).toThrow(/circuit/i);
  });
  it("isolates canaries in a dedicated region", () => {
    expect(() => loadCanarySchedulerConfiguration({ ...valid, CANARY_REGION: "nl" })).toThrow(/canary/);
    expect(() => loadCanarySchedulerConfiguration({ ...valid, CANARY_REGION: "global" })).toThrow(/canary/);
    expect(loadCanarySchedulerConfiguration(valid).region).toBe("canary-global");
  });
  it("uses a separate scheduled authorization flag", () => {
    expect(() => loadCanarySchedulerConfiguration({ ...valid, CANARY_EXECUTION_MODE: "scheduled" })).toThrow(/SCHEDULED_CANARY_AUTHORIZED/);
    expect(loadCanarySchedulerConfiguration({ ...valid, CANARY_EXECUTION_MODE: "scheduled", TIKDD_SCHEDULED_CANARY_AUTHORIZED: "true" }).scheduled).toBe(true);
  });
});
