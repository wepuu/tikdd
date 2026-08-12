import { describe, expect, it } from "vitest";
import {
  ProviderRouter,
  ProviderRoutingError,
  SSSTwitterProvider,
  TwitterSaverProvider,
  type ProviderConcurrencySource,
  type ProviderHealthSource,
  type ResolveInput
} from "../src/index";

const input: ResolveInput = {
  taskId: "tsk_99999999999999999999999999999999",
  sourceUrl: "https://twitter.com/authorized/status/123?s=20",
  canonicalUrl: "https://x.com/authorized/status/123",
  platform: "x"
};

const twitterResult = `
  <div>
    <h3>Authorized routing fixture</h3><p>0:42</p>
    <a href="https://dl.snapcdn.app/fixture/routing-720.mp4">Download MP4 (720p)</a>
  </div>`;
const ssLanding = `<form include-vals="tt:'fixture-token',ts:'12345678',source:'form'"></form>`;
const ssResult = `
  <section id="result">
    <h2>Authorized fallback fixture</h2>
    <a href="https://ssscdn.io/fixture/routing-720.mp4">Download MP4 720p</a>
  </section>`;

function response(body: string, url: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8");
  const value = new Response(body, { ...init, headers });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

function twitterProvider(
  outcome: "success" | "retryable" | "terminal",
  calls: string[]
): TwitterSaverProvider {
  return new TwitterSaverProvider({
    enabled: true,
    fetchImpl: async (request) => {
      const url = request.toString();
      calls.push(`twittersaver:${url.endsWith("/en") ? "landing" : "resolve"}`);
      if (outcome === "retryable") {
        return response("temporarily unavailable", url, { status: 503 });
      }
      if (url.endsWith("/en")) return response("<form></form>", url);
      if (outcome === "terminal") {
        return response(JSON.stringify({ status: "error", msg: "This post is private." }), url, {
          headers: { "content-type": "application/json" }
        });
      }
      return response(JSON.stringify({ status: "ok", data: twitterResult }), url, {
        headers: { "content-type": "application/json" }
      });
    }
  });
}

function ssProvider(outcome: "success" | "retryable", calls: string[]): SSSTwitterProvider {
  let requestCount = 0;
  return new SSSTwitterProvider({
    enabled: true,
    fetchImpl: async (request) => {
      requestCount += 1;
      calls.push(`ssstwitter:${requestCount === 1 ? "landing" : "resolve"}`);
      if (outcome === "retryable") {
        return response("temporarily unavailable", request.toString(), { status: 503 });
      }
      return response(requestCount === 1 ? ssLanding : ssResult, request.toString());
    }
  });
}

describe("production-shaped X routing contract", () => {
  it("locks deterministic priority and reviewed global region", () => {
    const twitter = twitterProvider("success", []);
    const ss = ssProvider("success", []);
    expect(twitter.manifest.regions).toEqual(["global", "canary-global"]);
    expect(ss.manifest.regions).toEqual(["global", "canary-global"]);
    expect(twitter.manifest.platforms).toEqual([{ platform: "x", priority: 900, deliveryModes: ["redirect"] }]);
    expect(ss.manifest.platforms).toEqual([{ platform: "x", priority: 800, deliveryModes: ["redirect"] }]);
  });

  it("returns primary success without calling the secondary", async () => {
    const calls: string[] = [];
    const routed = await new ProviderRouter([
      ssProvider("success", calls),
      twitterProvider("success", calls)
    ]).resolve(input);

    expect(routed.resolution.result.provenance.provider).toBe("twittersaver");
    expect(calls).toEqual(["twittersaver:landing", "twittersaver:resolve"]);
    expect(routed.attempts.map(({ providerId, status }) => [providerId, status])).toEqual([
      ["twittersaver", "succeeded"]
    ]);
  });

  it("falls back sequentially after a retryable primary failure", async () => {
    const calls: string[] = [];
    const routed = await new ProviderRouter([
      ssProvider("success", calls),
      twitterProvider("retryable", calls)
    ]).resolve(input);

    expect(routed.resolution.result.provenance.provider).toBe("ssstwitter");
    expect(calls).toEqual([
      "twittersaver:landing",
      "ssstwitter:landing",
      "ssstwitter:resolve"
    ]);
    expect(routed.attempts.map(({ providerId, failureCode }) => [providerId, failureCode])).toEqual([
      ["twittersaver", "provider_unavailable"],
      ["ssstwitter", null]
    ]);
  });

  it("stops on a terminal primary result without consulting the secondary", async () => {
    const calls: string[] = [];
    const router = new ProviderRouter([
      ssProvider("success", calls),
      twitterProvider("terminal", calls)
    ]);

    await expect(router.resolve(input)).rejects.toMatchObject({
      failureCode: "content_private",
      retryable: false
    });
    expect(calls).toEqual(["twittersaver:landing", "twittersaver:resolve"]);
  });

  it("returns both sanitized attempts when both providers are unavailable", async () => {
    const calls: string[] = [];
    const router = new ProviderRouter([
      ssProvider("retryable", calls),
      twitterProvider("retryable", calls)
    ]);

    try {
      await router.resolve(input);
      throw new Error("Expected routing failure.");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderRoutingError);
      expect((error as ProviderRoutingError).attempts.map(({ providerId }) => providerId)).toEqual([
        "twittersaver",
        "ssstwitter"
      ]);
      expect(JSON.stringify((error as ProviderRoutingError).attempts)).not.toContain("x.com");
      expect(JSON.stringify((error as ProviderRoutingError).attempts)).not.toContain("ssscdn.io");
    }
  });

  it("skips an open primary circuit and uses the secondary", async () => {
    const calls: string[] = [];
    const healthSource: ProviderHealthSource = {
      async get(key) {
        return {
          state: key.providerId === "twittersaver" ? "open" : "closed",
          successRate: 0,
          latencyP95Ms: 0,
          insufficientData: false,
          openUntil:
            key.providerId === "twittersaver"
              ? new Date(Date.now() + 60_000).toISOString()
              : null,
          calculatedAt: new Date().toISOString()
        };
      },
      async acquireProbe() {
        return false;
      }
    };
    const routed = await new ProviderRouter(
      [ssProvider("success", calls), twitterProvider("success", calls)],
      { healthSource }
    ).resolve(input);

    expect(routed.resolution.result.provenance.provider).toBe("ssstwitter");
    expect(calls).toEqual(["ssstwitter:landing", "ssstwitter:resolve"]);
  });

  it("skips a concurrency-busy primary without consuming the attempt budget", async () => {
    const calls: string[] = [];
    const concurrencySource: ProviderConcurrencySource = {
      async acquire(key) {
        if (key.providerId === "twittersaver") return null;
        return { async release() {} };
      }
    };
    const routed = await new ProviderRouter(
      [ssProvider("success", calls), twitterProvider("success", calls)],
      { concurrencySource, maxAttempts: 1 }
    ).resolve(input);

    expect(routed.resolution.result.provenance.provider).toBe("ssstwitter");
    expect(routed.attempts).toHaveLength(1);
    expect(calls).toEqual(["ssstwitter:landing", "ssstwitter:resolve"]);
  });

  it("does not call the secondary after the route attempt budget is exhausted", async () => {
    const calls: string[] = [];
    const router = new ProviderRouter(
      [ssProvider("success", calls), twitterProvider("retryable", calls)],
      { maxAttempts: 1 }
    );

    await expect(router.resolve(input)).rejects.toBeInstanceOf(ProviderRoutingError);
    expect(calls).toEqual(["twittersaver:landing"]);
  });

  it("denies the exact providers outside their reviewed region", async () => {
    const calls: string[] = [];
    const router = new ProviderRouter(
      [ssProvider("success", calls), twitterProvider("success", calls)],
      { region: "eu-west-1" }
    );
    await expect(router.resolve(input)).rejects.toMatchObject({ name: "NoProviderAvailableError" });
    expect(calls).toEqual([]);
  });
});
