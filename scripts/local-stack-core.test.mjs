import { describe, expect, it, vi } from "vitest";
import {
  buildLocalStackProfile,
  parseEnvironmentFile,
  validateDockerServices,
  verifyProviderEgress
} from "./local-stack-core.mjs";

const entropy = (size) => Buffer.alloc(size, 7);

describe("local stack profile", () => {
  it("forces the default profile offline even when a local env file enables real providers", () => {
    const profile = buildLocalStackProfile({
      mode: "offline",
      commandEnvironment: { HTTP_PROXY: "http://inherited.invalid:9999" },
      fileEnvironment: {
        ENABLE_TWITTERSAVER_PROVIDER: "true",
        TWITTERSAVER_TERMS_APPROVED: "true"
      },
      entropy
    });

    expect(profile.providers).toEqual([]);
    expect(profile.environment.ENABLE_MOCK_PROVIDER).toBe("true");
    expect(profile.environment.ENABLE_TWITTERSAVER_PROVIDER).toBe("false");
    expect(profile.environment.HTTP_PROXY).toBeUndefined();
    expect(profile.environment.LOCAL_STACK_READINESS_TOKEN).toHaveLength(32);
  });

  it("rejects a pilot without current-shell authorization", () => {
    expect(() =>
      buildLocalStackProfile({
        mode: "pilot",
        commandEnvironment: { TIKDD_PILOT_PROVIDERS: "twittersaver" },
        entropy
      })
    ).toThrow("TIKDD_LOCAL_LIVE_AUTHORIZED=true");
  });

  it("requires exact provider approvals and creates ephemeral delivery material", () => {
    const profile = buildLocalStackProfile({
      mode: "pilot",
      commandEnvironment: {
        TIKDD_LOCAL_LIVE_AUTHORIZED: "true",
        TIKDD_PILOT_PROVIDERS: "twittersaver,ssstwitter",
        TWITTERSAVER_TERMS_APPROVED: "true",
        SSSTWITTER_TERMS_APPROVED: "true",
        SSSTWITTER_DELIVERY_AUDIT_APPROVED: "true",
        TIKDD_PILOT_PROXY_URL: "http://127.0.0.1:10808"
      },
      entropy
    });

    expect(profile.providers).toEqual(["twittersaver", "ssstwitter"]);
    expect(profile.providerHosts).toEqual(["twittersaver.net", "ssstwitter.com"]);
    expect(profile.environment.ENABLE_MOCK_PROVIDER).toBe("false");
    expect(profile.environment.NODE_USE_ENV_PROXY).toBe("1");
    expect(profile.environment.DELIVERY_ENCRYPTION_KEY_BASE64URL).toHaveLength(43);
    expect(profile.environment.DELIVERY_ENCRYPTION_KEY_ID).toMatch(/^local-pilot-/);
  });

  it("does not accept approval flags only from the persistent env file", () => {
    expect(() =>
      buildLocalStackProfile({
        mode: "pilot",
        commandEnvironment: {
          TIKDD_LOCAL_LIVE_AUTHORIZED: "true",
          TIKDD_PILOT_PROVIDERS: "dlpanda"
        },
        fileEnvironment: { DLPANDA_TERMS_APPROVED: "true" },
        entropy
      })
    ).toThrow("DLPANDA_TERMS_APPROVED=true");
  });
});

describe("local stack preflight", () => {
  it("parses simple dotenv values without expansion", () => {
    expect(parseEnvironmentFile("A=1\nB=\"two words\"\n# ignored\n")).toEqual({
      A: "1",
      B: "two words"
    });
  });

  it("requires both Docker services to be running and healthy", () => {
    expect(() =>
      validateDockerServices([
        { Service: "postgres", State: "running", Health: "healthy" },
        { Service: "redis", State: "running", Health: "starting" }
      ])
    ).toThrow("redis is not healthy");
  });

  it("fails before readiness when one provider page host has no egress", async () => {
    const probe = vi.fn(async (host) => {
      if (host === "ssstwitter.com") throw new Error("blocked");
    });
    await expect(
      verifyProviderEgress(["twittersaver.net", "ssstwitter.com"], probe)
    ).rejects.toThrow("Provider page-host egress failed for ssstwitter.com");
    expect(probe).toHaveBeenCalledTimes(2);
  });
});
