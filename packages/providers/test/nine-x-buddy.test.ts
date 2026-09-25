import { describe, expect, it } from "vitest";
import {
  NineXBuddyProvider,
  createNineXBuddyAuthToken,
  isNineXBuddyLandingChallenge,
  parseNineXBuddyResponse,
  type NineXBuddyDiagnosticEvent,
  type ResolveInput
} from "../src/index";

const input: ResolveInput = {
  taskId: "tsk_5123456789abcdef0123456789abcdef",
  sourceUrl: "https://xhamster.com/videos/fixture-video",
  canonicalUrl: "https://xhamster.com/videos/fixture-video",
  platform: "xhamster"
};

const bootstrapHtml = `<html><head><link href="/build/main.9b0c5d2fd8241a25652e.css"></head><body><script src="/challenge-platform.js"></script><script>window.__INIT__ = ${JSON.stringify({
  apiBase: "https://ab.9xbud.com",
  appVersion: "12.18.7",
  ua: "VGlrREQtcHJvdmlkZXJMYWIvMS4w",
  searchProviders: { xh: "xhamster" }
})};</script></body></html>`;

function encodeDescriptor(value: string, responseToken: string, cssHash: string): string {
  const key = `SORRY_MATE${"9xbuddy.com".length}${cssHash}${responseToken}`;
  const bytes = [...value].map((character, index) =>
    character.charCodeAt(0) + key.substr((index % key.length) - 1, 1).charCodeAt(0)
  );
  return Buffer.from(bytes.reverse()).toString("hex");
}

function jsonResponse(body: unknown, url: string): Response {
  const response = new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("9xBuddy xHamster adapter", () => {
  it("recreates the dynamic token and prepares one anonymous MP4 artifact", async () => {
    const cssHash = "9b0c5d2fd8241a25652e";
    const responseToken = "response-token-fixture";
    const descriptor = encodeDescriptor("/download/source-uid/opaque-descriptor", responseToken, cssHash);
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const diagnostics: NineXBuddyDiagnosticEvent[] = [];
    const provider = new NineXBuddyProvider({
      enabled: true,
      approvedPlatforms: ["xhamster"],
      deliveryVerifiedPlatforms: ["xhamster"],
      pollIntervalMs: 0,
      diagnosticSink: (event) => diagnostics.push(event),
      fetchImpl: async (url, init) => {
        const requestUrl = typeof url === "string" || url instanceof URL ? new URL(url) : new URL(url.url);
        calls.push({ url: requestUrl.toString(), init: init ?? {} });
        const path = requestUrl.pathname;
        if (path === "/") return new Response(bootstrapHtml, { status: 200, headers: { "content-type": "text/html" } });
        if (path === "/token") return jsonResponse({ status: true, access_token: "access-token-fixture" }, url.toString());
        if (path === "/extract") return jsonResponse({ status: true, response: {
          token: responseToken,
          title: "Fixture xHamster video",
          thumbnail: "https://9xbuddy.com/fixture.jpg",
          formats: [{ ext: "mp4", quality: "720", url: descriptor }]
        } }, url.toString());
        if (path === "/download") {
          const body = JSON.parse(String(init?.body));
          return body.mode === "prepare"
            ? jsonResponse({ status: true, uid: "prepared-uid" }, url.toString())
            : jsonResponse({ status: true, state: "choice_required", direct_hls: { url: "https://ab.9xbud.com/hls/fixture.m3u8" } }, url.toString());
        }
        if (path === "/progress") return jsonResponse({ status: true, progress: { phase: "ready" }, response: { url: "https://ab.9xbud.com/download/fixture.mp4" } }, url.toString());
        throw new Error(`Unexpected endpoint ${path}`);
      }
    });

    const resolution = await provider.resolve(input);
    expect(calls.map(({ url }) => new URL(url).pathname)).toEqual([
      "/", "/token", "/extract", "/download", "/download", "/progress"
    ]);
    expect(calls[1]?.init.headers).toEqual(expect.objectContaining({
      "x-auth-token": expect.any(String),
      "x-requested-domain": "9xbuddy.com"
    }));
    expect(calls[2]?.init.headers).toEqual(expect.objectContaining({ "x-access-token": "access-token-fixture" }));
    expect(resolution.result.media.thumbnailUrl).toBe("https://9xbuddy.com/fixture.jpg");
    expect(resolution.result.formats[0]).toMatchObject({ container: "mp4", quality: "720p" });
    expect(resolution.candidates[0]).toMatchObject({
      mode: "redirect",
      hostPolicyId: "9xbuddy-xhamster-artifact-v1"
    });
    expect(JSON.stringify(resolution.result)).not.toContain("ab.9xbud.com");
    expect(JSON.stringify(resolution.candidates)).toContain("ab.9xbud.com");
    expect(diagnostics[0]).toMatchObject({
      phase: "completed",
      contentType: "application/json",
      bootstrapPresent: true,
      challengeMarker: "embedded"
    });
  });

  it("does not treat the normal embedded challenge-platform bundle marker as a challenge", () => {
    expect(isNineXBuddyLandingChallenge({
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      body: bootstrapHtml
    })).toBe(false);
    expect(isNineXBuddyLandingChallenge({
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      body: "<html><body><script src=\"/challenge-platform.js\"></script></body></html>"
    })).toBe(true);
  });

  it("exposes the token vector and rejects a malformed descriptor", () => {
    const token = createNineXBuddyAuthToken({
      appVersion: "12.18.7",
      userAgentSeed: "VGlrREQtcHJvdmlkZXJMYWIvMS4w",
      cssHash: "9b0c5d2fd8241a25652e"
    });
    expect(token).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(() => parseNineXBuddyResponse(JSON.stringify({ response: {
      token: "token",
      formats: [{ ext: "mp4", quality: "720", url: "not-hex" }]
    } }), "9b0c5d2fd8241a25652e")).toThrow(/descriptor|MP4/i);
  });

  it("does not spend the fallback route on private or invalid content", () => {
    expect(() => parseNineXBuddyResponse(JSON.stringify({ status: false, message: "private media" }), "fixture"))
      .toThrow(/private/i);
    expect(() => parseNineXBuddyResponse(JSON.stringify({ status: false, message: "invalid URL" }), "fixture"))
      .toThrow(/rejected/i);
  });

  it("keeps Dailymotion as Lab-only until a delivery policy is audited", () => {
    const provider = new NineXBuddyProvider({ enabled: true, approvedPlatforms: ["xhamster", "dailymotion"] });
    expect(provider.manifest.platforms).toEqual(expect.arrayContaining([
      expect.objectContaining({ platform: "xhamster", priority: 700, deliveryModes: ["redirect"] }),
      expect.objectContaining({ platform: "dailymotion", deliveryModes: [] })
    ]));
  });

  it("bounds concurrent requests and enforces a small inter-request interval", async () => {
    let now = 1_700_000_000_000;
    const provider = new NineXBuddyProvider({
      enabled: true,
      now: () => now,
      maxConcurrency: 1,
      minIntervalMs: 2_000,
      fetchImpl: async () => { throw new Error("offline fixture"); }
    });
    await expect(provider.resolve(input)).rejects.toMatchObject({ failureCode: "provider_unavailable" });
    await expect(provider.resolve(input)).rejects.toMatchObject({ failureCode: "provider_rate_limited" });
    now += 2_000;
  });
});
