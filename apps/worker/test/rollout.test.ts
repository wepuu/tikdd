import type { RolloutRuleRepository } from "@tikdd/persistence";
import type { Redis } from "ioredis";
import { describe, expect, it } from "vitest";
import {
  createRolloutRuntime,
  loadRolloutConfiguration
} from "../src/rollout";

const request = {
  taskId: "tsk_0123456789abcdef0123456789abcdef",
  providerId: "twittersaver",
  providerKind: "site-adapter" as const,
  platform: "x",
  region: "global"
};

describe("worker rollout configuration", () => {
  it("allows the local mock but denies real providers without an explicit development bypass", async () => {
    const runtime = await createRolloutRuntime({
      redis: {} as Redis,
      repository: {} as RolloutRuleRepository,
      configuration: loadRolloutConfiguration({ NODE_ENV: "development" }),
      production: false
    });

    await expect(runtime.source.decide(request)).resolves.toMatchObject({
      allowed: false,
      reason: "control_unavailable"
    });
    await expect(
      runtime.source.decide({
        ...request,
        providerId: "development-mock",
        providerKind: "mock"
      })
    ).resolves.toMatchObject({ allowed: true, reason: "development_bypass" });
  });

  it("never accepts the development bypass or mock provider in production", async () => {
    expect(() =>
      loadRolloutConfiguration({
        NODE_ENV: "production",
        PROVIDER_ROLLOUT_DEVELOPMENT_BYPASS: "true"
      })
    ).toThrow(/cannot be enabled in production/);

    const runtime = await createRolloutRuntime({
      redis: {} as Redis,
      repository: {} as RolloutRuleRepository,
      configuration: loadRolloutConfiguration({ NODE_ENV: "production" }),
      production: true
    });
    await expect(
      runtime.source.decide({
        ...request,
        providerId: "development-mock",
        providerKind: "mock"
      })
    ).resolves.toMatchObject({ allowed: false, reason: "production_mock_denied" });
  });

  it("bounds refresh and stale intervals and requires a cohort secret", () => {
    expect(() =>
      loadRolloutConfiguration({ PROVIDER_ROLLOUT_ENABLED: "yes" })
    ).toThrow(/must be true or false/);
    expect(() =>
      loadRolloutConfiguration({
        PROVIDER_ROLLOUT_ENABLED: "true",
        PROVIDER_ROLLOUT_REFRESH_MS: "5001",
        PROVIDER_ROLLOUT_COHORT_KEY_BASE64URL: Buffer.alloc(32).toString("base64url")
      })
    ).toThrow(/between 1000 and 5000/);
    expect(() => loadRolloutConfiguration({ PROVIDER_ROLLOUT_ENABLED: "true" })).toThrow(
      /COHORT_KEY/
    );
    expect(() =>
      loadRolloutConfiguration({
        PROVIDER_ROLLOUT_ENABLED: "true",
        PROVIDER_ROLLOUT_COHORT_KEY_BASE64URL: "not+base64url"
      })
    ).toThrow(/base64url/);
  });
});
