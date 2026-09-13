import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ProviderRouter,
  SaveFromInsProvider,
  SnapInstaProvider,
  SnapTikMonsterProvider,
  TikVidProvider,
  qualifyFreeProviderPortfolio,
  type ResolveInput
} from "../src/index";

const fixture = (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const tiktokInput: ResolveInput = {
  taskId: "tsk_5123456789abcdef0123456789abcdef",
  sourceUrl: "https://www.tiktok.com/@fixture/video/7615724915156667679",
  canonicalUrl: "https://www.tiktok.com/@fixture/video/7615724915156667679",
  platform: "tiktok"
};

const instagramInput: ResolveInput = {
  taskId: "tsk_6123456789abcdef0123456789abcdef",
  sourceUrl: "https://www.instagram.com/reel/Fixture/",
  canonicalUrl: "https://www.instagram.com/reel/Fixture/",
  platform: "instagram"
};

function htmlResponse(body: string, url: string, status = 200): Response {
  const response = new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("Work Item 51 free Provider adapters", () => {
  it("keeps new candidates disabled and resolution-only", () => {
    expect(new TikVidProvider().manifest).toMatchObject({
      id: "tikvid",
      enabled: false,
      platforms: [{ platform: "tiktok", deliveryModes: [], verificationStatus: "canary_failed" }]
    });
    expect(new SnapInstaProvider().manifest).toMatchObject({
      id: "snapinsta",
      enabled: false,
      platforms: [{ platform: "instagram", deliveryModes: [], verificationStatus: "canary_failed" }]
    });
  });

  it("normalizes TikVid MP4 results without exposing the source URL or CDN URL", async () => {
    const [landing, success] = await Promise.all([fixture("tikvid-landing.html"), fixture("tikvid-success.html")]);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const provider = new TikVidProvider({
      enabled: true,
      fetchImpl: async (input, init) => {
        calls.push({ url: input.toString(), ...(init ? { init } : {}) });
        return htmlResponse(calls.length === 1 ? landing : success, input.toString());
      }
    });
    const resolution = await provider.resolve(tiktokInput);
    expect(resolution.result.formats).toHaveLength(1);
    expect(resolution.result.formats[0]).toMatchObject({ container: "mp4", hasVideo: true });
    expect(resolution.candidates).toEqual([]);
    expect(JSON.stringify(resolution.result)).not.toContain("media.tikvid.cc");
    expect(calls[1]?.init?.method).toBe("GET");
    expect(calls[1]?.init?.body).toBeUndefined();
    const submitted = new URL(calls[1]?.url ?? "https://invalid.example.test");
    expect(submitted.pathname).toBe("/en1/download");
    expect(submitted.searchParams.get("url")).toBe(tiktokInput.canonicalUrl);
    expect(submitted.searchParams.get("csrf_token")).toBe("fixture-token");
  });

  it("normalizes SnapInsta Reel results and rejects private content as terminal", async () => {
    const [landing, success, privateHtml] = await Promise.all([
      fixture("snapinsta-landing.html"),
      fixture("snapinsta-success.html"),
      fixture("snapinsta-private.html")
    ]);
    let calls = 0;
    const provider = new SnapInstaProvider({
      enabled: true,
      fetchImpl: async (input) => {
        calls += 1;
        return htmlResponse(calls <= 2 ? (calls === 1 ? landing : success) : privateHtml, input.toString());
      }
    });
    const resolution = await provider.resolve(instagramInput);
    expect(resolution.result.formats).toHaveLength(1);
    expect(resolution.candidates).toEqual([]);
    await expect(provider.resolve(instagramInput)).rejects.toMatchObject({
      failureCode: "content_private",
      retryable: false,
      fallbackAllowed: false
    });
  });

  it("fails closed on a provider-page redirect outside the exact allowlist", async () => {
    const provider = new TikVidProvider({
      enabled: true,
      fetchImpl: async (input) => new Response(null, {
        status: 302,
        headers: { location: "https://evil.example.test/redirect", "content-type": "text/html" }
      })
    });
    await expect(provider.resolve(tiktokInput)).rejects.toMatchObject({
      failureCode: "invalid_result",
      fallbackAllowed: true
    });
  });

  it("follows a bounded same-host result redirect without changing a GET submission to POST", async () => {
    const [landing, success] = await Promise.all([fixture("tikvid-landing.html"), fixture("tikvid-success.html")]);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const provider = new TikVidProvider({
      enabled: true,
      fetchImpl: async (input, init) => {
        calls.push({ url: input.toString(), ...(init ? { init } : {}) });
        if (calls.length === 1) return htmlResponse(landing, input.toString());
        if (calls.length === 2) {
          const response = new Response(null, {
            status: 302,
            headers: { location: "/en1/result/fixture", "content-type": "text/html" }
          });
          Object.defineProperty(response, "url", { value: input.toString() });
          return response;
        }
        return htmlResponse(success, input.toString());
      }
    });

    await expect(provider.resolve(tiktokInput)).resolves.toMatchObject({ candidates: [] });
    expect(calls).toHaveLength(3);
    expect(calls[1]?.init?.method).toBe("GET");
    expect(calls[2]?.url).toBe("https://tikvid.cc/en1/result/fixture");
    expect(calls[2]?.init?.method).toBe("GET");
  });

  it.each([
    ["tikvid-private.html", "content_private", false],
    ["tikvid-not-found.html", "content_not_found", false],
    ["tikvid-challenge.html", "provider_challenge", true],
    ["tikvid-empty.html", "invalid_result", true]
  ] as const)("maps %s to a bounded failure decision", async (fixtureName, failureCode, fallbackAllowed) => {
    const landing = await fixture("tikvid-landing.html");
    const body = await fixture(fixtureName);
    let calls = 0;
    const provider = new TikVidProvider({
      enabled: true,
      fetchImpl: async (input) => {
        calls += 1;
        return htmlResponse(calls === 1 ? landing : body, input.toString());
      }
    });
    await expect(provider.resolve(tiktokInput)).rejects.toMatchObject({ failureCode, fallbackAllowed });
    expect(calls).toBe(2);
  });
});

describe("Work Item 51 portfolio qualification", () => {
  it("keeps the two implemented candidates deferred until delivery review", () => {
    const results = qualifyFreeProviderPortfolio();
    expect(results.filter(({ providerId }) => ["tikvid", "snapinsta"].includes(providerId))).toEqual([
      expect.objectContaining({ providerId: "tikvid", status: "deferred", productionRouteEligible: false }),
      expect.objectContaining({ providerId: "snapinsta", status: "deferred", productionRouteEligible: false })
    ]);
    expect(results.filter(({ providerId }) => ["tikvid", "snapinsta"].includes(providerId)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ reasons: expect.arrayContaining(["canary_failed"]) }),
        expect.objectContaining({ reasons: expect.arrayContaining(["canary_failed"]) })
      ]));
    expect(results.find(({ providerId }) => providerId === "savevid")).toMatchObject({
      status: "deferred",
      reasons: expect.arrayContaining(["technical_blocked"])
    });
    expect(results.find(({ providerId }) => providerId === "tikcd")).toMatchObject({
      status: "deferred",
      reasons: expect.arrayContaining(["delivery_unverified"])
    });
    expect(results.find(({ providerId }) => providerId === "gramsnap")).toMatchObject({
      status: "deferred",
      productionRouteEligible: false,
      reasons: expect.arrayContaining(["technical_blocked"])
    });
  });
});

describe("Work Item 51 bounded secondary routing", () => {
  it("falls back sequentially to the TikVid candidate in development only", async () => {
    const [landing, success] = await Promise.all([fixture("tikvid-landing.html"), fixture("tikvid-success.html")]);
    const primary = new SnapTikMonsterProvider({
      enabled: true,
      fetchImpl: async (input) => htmlResponse("<p>provider unavailable</p>", input.toString(), 503)
    });
    let calls = 0;
    const secondary = new TikVidProvider({
      enabled: true,
      fetchImpl: async (input, init) => {
        calls += 1;
        return htmlResponse(calls === 1 ? landing : success, input.toString());
      }
    });
    const allow = { async decide() { return { allowed: true, reason: "allowed" as const, ruleId: "wi51", snapshotRevision: 1, bucket: 0 }; } };
    const routed = await new ProviderRouter([primary, secondary], {
      production: false,
      region: "nl",
      rolloutSource: allow,
      maxAttempts: 2
    }).resolve(tiktokInput);
    expect(routed.resolution.result.provenance.provider).toBe("tikvid");
    expect(routed.attempts.map(({ providerId, status }) => [providerId, status])).toEqual([
      ["snaptik-monster", "failed"],
      ["tikvid", "succeeded"]
    ]);
    expect(routed.resolution.candidates).toEqual([]);
  });

  it("falls back sequentially to the SnapInsta candidate for Instagram in development only", async () => {
    const [landing, success] = await Promise.all([
      fixture("snapinsta-landing.html"),
      fixture("snapinsta-success.html")
    ]);
    const primary = new SaveFromInsProvider({
      enabled: true,
      requestAuth: "fixtureauth123",
      fetchImpl: async () => new Response(JSON.stringify({
        status: 0,
        status_code: "error",
        message: "Too many requests"
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    });
    let calls = 0;
    const secondary = new SnapInstaProvider({
      enabled: true,
      fetchImpl: async (input) => {
        calls += 1;
        return htmlResponse(calls === 1 ? landing : success, input.toString());
      }
    });
    const allow = { async decide() { return { allowed: true, reason: "allowed" as const, ruleId: "wi51", snapshotRevision: 1, bucket: 0 }; } };
    const routed = await new ProviderRouter([primary, secondary], {
      production: false,
      region: "nl",
      rolloutSource: allow,
      maxAttempts: 2
    }).resolve(instagramInput);
    expect(routed.resolution.result.provenance.provider).toBe("snapinsta");
    expect(routed.attempts.map(({ providerId, status }) => [providerId, status])).toEqual([
      ["savefromins", "failed"],
      ["snapinsta", "succeeded"]
    ]);
  });

  it("does not admit resolution-only candidates in production", async () => {
    const provider = new TikVidProvider({ enabled: true, fetchImpl: async () => { throw new Error("must not call"); } });
    const allow = { async decide() { return { allowed: true, reason: "allowed" as const, ruleId: "wi51", snapshotRevision: 1, bucket: 0 }; } };
    await expect(new ProviderRouter([provider], { production: true, region: "nl", rolloutSource: allow }).resolve(tiktokInput))
      .rejects.toMatchObject({ failureCode: "provider_unavailable" });
  });
});
