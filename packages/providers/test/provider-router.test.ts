import type { Platform } from "@tikdd/contracts";
import type { ProviderResolution } from "@tikdd/delivery-core";
import { describe, expect, it } from "vitest";
import {
  MockProvider,
  ProviderError,
  ProviderRouter,
  ProviderRoutingError,
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
});
