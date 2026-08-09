import { describe, expect, it } from "vitest";
import type Redis from "ioredis";
import {
  AdmissionControlPolicySchema,
  InvalidForwardingChainError,
  TrustedProxyResolver,
  RedisAdmissionStore,
  loadAdmissionControlConfiguration,
  resolveProviderConcurrencyLimit
} from "../src/index";

const policy = AdmissionControlPolicySchema.parse({
  version: "pilot-v1",
  deployment: "test",
  region: "global",
  requestWindowMs: 60_000,
  clientRequestLimit: 10,
  globalRequestLimit: 100,
  clientActiveTaskLimit: 2,
  globalActiveTaskLimit: 20,
  taskPermitTtlMs: 300_000,
  providerDefaultConcurrency: 4,
  providerLeaseTtlMs: 45_000,
  providerLimits: [
    { providerId: "twitter-saver", platform: "*", region: "*", limit: 3 },
    { providerId: "twitter-saver", platform: "x", region: "*", limit: 2 },
    { providerId: "twitter-saver", platform: "x", region: "global", limit: 1 }
  ]
});

describe("Redis admission failure boundary", () => {
  it("propagates Redis failure so callers can fail closed", async () => {
    const unavailableRedis = {
      async eval() {
        throw new Error("redis unavailable");
      }
    } as unknown as Redis;
    const store = new RedisAdmissionStore(unavailableRedis, policy);

    await expect(
      store.admitTask({
        clientIdentityDigest: Buffer.alloc(32, 1),
        permitId: "tsk_0123456789abcdef0123456789abcdef",
        referenceId: "adr_0123456789abcdef0123456789abcdef"
      })
    ).rejects.toThrow(/unavailable/);
  });
});

describe("admission control policy", () => {
  it("selects the most specific provider concurrency limit", () => {
    expect(
      resolveProviderConcurrencyLimit(policy, {
        providerId: "twitter-saver",
        platform: "x",
        region: "global"
      })
    ).toBe(1);
    expect(
      resolveProviderConcurrencyLimit(policy, {
        providerId: "twitter-saver",
        platform: "youtube",
        region: "eu-west-1"
      })
    ).toBe(3);
    expect(
      resolveProviderConcurrencyLimit(policy, {
        providerId: "dlpanda",
        platform: "tiktok",
        region: "global"
      })
    ).toBe(4);
  });

  it("rejects unsafe production bypass and ambiguous policy entries", () => {
    expect(() =>
      loadAdmissionControlConfiguration({
        NODE_ENV: "production",
        ADMISSION_CONTROL_ENABLED: "false"
      })
    ).toThrow(/cannot be disabled/i);
    expect(() =>
      AdmissionControlPolicySchema.parse({
        ...policy,
        providerLimits: [policy.providerLimits[0], policy.providerLimits[0]]
      })
    ).toThrow(/duplicate/i);
  });
});

describe("trusted proxy client identity", () => {
  it("ignores forwarding headers from direct or untrusted peers", () => {
    expect(
      new TrustedProxyResolver([]).resolve({
        socketAddress: "::ffff:203.0.113.7",
        forwardedFor: "198.51.100.9"
      })
    ).toBe("203.0.113.7");
    expect(
      new TrustedProxyResolver(["10.0.0.0/8"]).resolve({
        socketAddress: "203.0.113.7",
        forwardedFor: "198.51.100.9"
      })
    ).toBe("203.0.113.7");
  });

  it("accepts one unambiguous client behind reviewed proxy networks", () => {
    const resolver = new TrustedProxyResolver(["10.0.0.0/8", "192.168.0.0/16"]);
    expect(
      resolver.resolve({
        socketAddress: "10.0.0.4",
        forwardedFor: "203.0.113.8, 192.168.1.9"
      })
    ).toBe("203.0.113.8");
  });

  it("rejects invalid and attacker-prefixed forwarding chains from trusted peers", () => {
    const resolver = new TrustedProxyResolver(["10.0.0.0/8"]);
    expect(() =>
      resolver.resolve({ socketAddress: "10.0.0.4", forwardedFor: "not-an-ip" })
    ).toThrow(InvalidForwardingChainError);
    expect(() =>
      resolver.resolve({
        socketAddress: "10.0.0.4",
        forwardedFor: "198.51.100.2, 203.0.113.8"
      })
    ).toThrow(InvalidForwardingChainError);
  });
});
