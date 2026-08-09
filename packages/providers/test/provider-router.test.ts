import type { Platform } from "@tikdd/contracts";
import type { ProviderResolution } from "@tikdd/delivery-core";
import { describe, expect, it } from "vitest";
import {
  FailureInjectionProvider,
  MockProvider,
  ProviderError,
  ProviderRouter,
  ProviderRoutingError,
  type ProviderCircuitKey,
  type ProviderConcurrencySource,
  type ProviderHealthSnapshot,
  type ProviderHealthSource,
  type ProviderManifest,
  type ResolveInput,
  type ResolverProvider
} from "../src/index";

class TestProvider implements ResolverProvider {
  readonly manifest: ProviderManifest;
  readonly calls: string[];

  constructor(
    id: string,
    priority: number,
    private readonly outcome: "success" | "retryable" | "terminal",
    calls: string[],
    platform: Platform = "youtube"
  ) {
    this.calls = calls;
    this.manifest = {
      id,
      displayName: id,
      kind: "site-adapter",
      enabled: true,
      regions: ["*"],
      timeoutMs: 1_000,
      costWeight: 0,
      platforms: [{ platform, priority }]
    };
  }

  async resolve(input: ResolveInput): Promise<ProviderResolution> {
    this.calls.push(this.manifest.id);
    if (this.outcome === "retryable") {
      throw new ProviderError("challenge", "provider_challenge", true, true);
    }
    if (this.outcome === "terminal") {
      throw new ProviderError("private", "content_private", false, false);
    }
    return new MockProvider([input.platform]).resolve(input);
  }
}

const input: ResolveInput = {
  taskId: "tsk_0123456789abcdef0123456789abcdef",
  sourceUrl: "https://youtu.be/abcdefghijk",
  canonicalUrl: "https://youtu.be/abcdefghijk",
  platform: "youtube"
};

describe("ProviderRouter", () => {
  it("returns a normalized mock result", async () => {
    const router = new ProviderRouter([new MockProvider(["youtube"])]);
    const routed = await router.resolve(input);

    expect(routed.resolution.result.schemaVersion).toBe("1.0");
    expect(routed.resolution.result.provenance.kind).toBe("mock");
    expect(routed.resolution.candidates).toEqual([]);
    expect(routed.attempts).toHaveLength(1);
    expect(routed.attempts[0]?.status).toBe("succeeded");
    expect(routed.attempts[0]?.region).toBe("global");
  });

  it("looks up health and records attempts with the complete circuit key", async () => {
    const keys: ProviderCircuitKey[] = [];
    const healthSource: ProviderHealthSource = {
      async get(key): Promise<ProviderHealthSnapshot> {
        keys.push(key);
        return {
          state: "closed",
          successRate: 1,
          latencyP95Ms: 0,
          insufficientData: false,
          openUntil: null,
          calculatedAt: new Date().toISOString()
        };
      },
      async acquireProbe() {
        return false;
      }
    };
    const router = new ProviderRouter([new MockProvider(["youtube"])], {
      region: "eu-west-1",
      healthSource
    });

    const routed = await router.resolve(input);

    expect(keys).toEqual([
      { providerId: "development-mock", platform: "youtube", region: "eu-west-1" }
    ]);
    expect(routed.attempts[0]?.region).toBe("eu-west-1");
  });

  it("applies rollout permission before reading circuit health", async () => {
    let healthReads = 0;
    const router = new ProviderRouter([new TestProvider("denied", 100, "success", [])], {
      rolloutSource: {
        async decide() {
          return {
            allowed: false,
            reason: "matching_deny",
            ruleId: "deny-provider",
            snapshotRevision: 3,
            bucket: null
          };
        }
      },
      healthSource: {
        async get() {
          healthReads += 1;
          throw new Error("Health must not be read for a denied route.");
        },
        async acquireProbe() {
          return false;
        }
      }
    });

    await expect(router.resolve(input)).rejects.toMatchObject({
      name: "ProviderRoutingError",
      retryable: false
    });
    expect(healthReads).toBe(0);
  });

  it("keeps missing rollout control retryable while failing closed", async () => {
    const router = new ProviderRouter([new TestProvider("unavailable", 100, "success", [])], {
      rolloutSource: {
        async decide() {
          return {
            allowed: false,
            reason: "control_unavailable",
            ruleId: null,
            snapshotRevision: null,
            bucket: null
          };
        }
      }
    });

    await expect(router.resolve(input)).rejects.toMatchObject({
      name: "NoProviderAvailableError",
      retryable: true
    });
  });

  it("refuses a production mock even when a rollout source grants it", async () => {
    const router = new ProviderRouter([new MockProvider(["youtube"])], {
      production: true,
      rolloutSource: {
        async decide() {
          return {
            allowed: true,
            reason: "allowed",
            ruleId: "unsafe-mock-grant",
            snapshotRevision: 1,
            bucket: 0
          };
        }
      }
    });

    await expect(router.resolve(input)).rejects.toMatchObject({
      name: "ProviderRoutingError",
      retryable: false
    });
  });

  it("isolates an open circuit to its exact provider, platform, and region", async () => {
    const calls: string[] = [];
    const healthSource: ProviderHealthSource = {
      async get(key) {
        return {
          state: key.providerId === "first" ? "open" : "closed",
          successRate: 0,
          latencyP95Ms: 0,
          insufficientData: false,
          openUntil:
            key.providerId === "first" ? new Date(Date.now() + 60_000).toISOString() : null,
          calculatedAt: new Date().toISOString()
        };
      },
      async acquireProbe() {
        return false;
      }
    };
    const router = new ProviderRouter(
      [
        new TestProvider("first", 100, "success", calls),
        new TestProvider("second", 20, "success", calls)
      ],
      { region: "global", healthSource }
    );

    await router.resolve(input);
    expect(calls).toEqual(["second"]);
  });

  it("routes one probe when an open circuit cooldown has elapsed", async () => {
    const calls: string[] = [];
    let probeRequests = 0;
    const healthSource: ProviderHealthSource = {
      async get() {
        return {
          state: "open",
          successRate: 0,
          latencyP95Ms: 0,
          insufficientData: false,
          openUntil: new Date(Date.now() - 1_000).toISOString(),
          calculatedAt: new Date().toISOString()
        };
      },
      async acquireProbe() {
        probeRequests += 1;
        return true;
      }
    };
    const router = new ProviderRouter([new TestProvider("probe", 100, "success", calls)], {
      healthSource
    });

    await router.resolve(input);
    expect(probeRequests).toBe(1);
    expect(calls).toEqual(["probe"]);
  });

  it("tries providers in descending platform priority", async () => {
    const calls: string[] = [];
    const router = new ProviderRouter([
      new TestProvider("second", 20, "success", calls),
      new TestProvider("first", 100, "retryable", calls)
    ]);

    const routed = await router.resolve(input);
    expect(calls).toEqual(["first", "second"]);
    expect(routed.attempts.map(({ status }) => status)).toEqual(["failed", "succeeded"]);
  });

  it("falls back sequentially when a provider concurrency permit is unavailable", async () => {
    const calls: string[] = [];
    const acquired: string[] = [];
    const released: string[] = [];
    const concurrencySource: ProviderConcurrencySource = {
      async acquire(key) {
        acquired.push(key.providerId);
        if (key.providerId === "busy") return null;
        return {
          async release() {
            released.push(key.providerId);
          }
        };
      }
    };
    const router = new ProviderRouter(
      [
        new TestProvider("busy", 100, "success", calls),
        new TestProvider("available", 90, "success", calls)
      ],
      { concurrencySource, maxAttempts: 1 }
    );

    const routed = await router.resolve(input);

    expect(acquired).toEqual(["busy", "available"]);
    expect(calls).toEqual(["available"]);
    expect(released).toEqual(["available"]);
    expect(routed.attempts).toHaveLength(1);
  });

  it("does not fall back for terminal policy/content failures", async () => {
    const calls: string[] = [];
    const router = new ProviderRouter([
      new TestProvider("terminal", 100, "terminal", calls),
      new TestProvider("unused", 20, "success", calls)
    ]);

    await expect(router.resolve(input)).rejects.toMatchObject({
      failureCode: "content_private",
      retryable: false
    });
    expect(calls).toEqual(["terminal"]);
  });

  it("returns an attempt ledger when all providers fail", async () => {
    const calls: string[] = [];
    const router = new ProviderRouter([
      new TestProvider("one", 100, "retryable", calls),
      new TestProvider("two", 90, "retryable", calls)
    ]);

    try {
      await router.resolve(input);
      throw new Error("Expected routing to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderRoutingError);
      expect((error as ProviderRoutingError).attempts).toHaveLength(2);
    }
  });

  it("bounds local failure injection to the configured route attempt budget", async () => {
    const first = new FailureInjectionProvider({
      id: "failure-one",
      platform: "youtube",
      priority: 100,
      outcomes: [
        {
          kind: "failure",
          failureCode: "provider_timeout",
          retryable: true,
          fallbackAllowed: true
        }
      ]
    });
    const second = new FailureInjectionProvider({
      id: "failure-two",
      platform: "youtube",
      priority: 90,
      outcomes: [{ kind: "success" }]
    });
    const router = new ProviderRouter([first, second], { maxAttempts: 1 });

    await expect(router.resolve(input)).rejects.toBeInstanceOf(ProviderRoutingError);
    expect(first.calls).toBe(1);
    expect(second.calls).toBe(0);
  });
});
