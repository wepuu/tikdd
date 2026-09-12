import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SnapTikMonsterProvider, type ResolveInput } from "../src/index";

const fixture = async (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const input: ResolveInput = {
  taskId: "tsk_4123456789abcdef0123456789abcdef",
  sourceUrl: "https://www.tiktok.com/@authorized/video/123456?share=fixture",
  canonicalUrl: "https://www.tiktok.com/@authorized/video/123456",
  platform: "tiktok"
};

function htmlResponse(body: string, url: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8");
  const response = new Response(body, { ...init, headers });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("SnapTikMonsterProvider", () => {
  it("normalizes reviewed MP4 resources and carries the landing cookie", async () => {
    const [landing, success] = await Promise.all([
      fixture("snaptik-monster-landing.html"),
      fixture("snaptik-monster-success.html")
    ]);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const provider = new SnapTikMonsterProvider({
      enabled: true,
      fetchImpl: async (request, init) => {
        const url = request.toString();
        calls.push({ url, ...(init ? { init } : {}) });
        if (calls.length === 1) {
          return htmlResponse(landing, url, {
            headers: { "set-cookie": "fixture_session=abc; Path=/; HttpOnly" }
          });
        }
        return htmlResponse(success, url);
      }
    });

    const resolution = await provider.resolve(input);
    expect(provider.manifest.enabled).toBe(true);
    expect(provider.manifest.platforms).toEqual([
      expect.objectContaining({
        platform: "tiktok",
        priority: 850,
        deliveryModes: ["redirect"],
        verificationStatus: "delivery_verified"
      })
    ]);
    expect(resolution.result.media.title).toBe("Authorized TikTok fixture");
    expect(resolution.result.media.thumbnailUrl).toBe(
      "https://tikcdn.beubagah.com/fixture/thumb.jpg"
    );
    expect(resolution.result.formats).toHaveLength(1);
    expect(resolution.result.formats[0]).toMatchObject({
      container: "mp4",
      mimeType: "video/mp4",
      quality: "HD",
      hasVideo: true,
      hasAudio: true
    });
    expect(resolution.candidates).toHaveLength(1);
    expect(resolution.candidates[0]).toMatchObject({
      mode: "redirect",
      hostPolicyId: "snaptik-monster-tiktok-media-v1",
      secretHeaders: {}
    });
    expect(JSON.stringify(resolution.result)).not.toContain("/fixture/video-720.mp4");
    expect(JSON.stringify(resolution.result)).not.toContain("redacted");
    expect(calls).toHaveLength(2);
    expect(calls[0]?.init?.redirect).toBe("manual");
    expect(calls[1]?.init?.headers).toMatchObject({
      cookie: "fixture_session=abc",
      origin: "https://snaptik.monster",
    });
    expect(calls[1]?.init?.body?.toString()).toBe(
      "_csrf=fixture-csrf-token-123&url=https%3A%2F%2Fwww.tiktok.com%2F%40authorized%2Fvideo%2F123456"
    );
  });

  it("is disabled by default and rejects non-TikTok inputs before network access", async () => {
    const provider = new SnapTikMonsterProvider();
    expect(provider.manifest.enabled).toBe(false);
    let calls = 0;
    const enabled = new SnapTikMonsterProvider({
      enabled: true,
      fetchImpl: async () => {
        calls += 1;
        return htmlResponse("", "https://snaptik.monster/");
      }
    });
    await expect(enabled.resolve({ ...input, platform: "x" })).rejects.toMatchObject({
      failureCode: "unsupported_url",
      fallbackAllowed: true
    });
    expect(calls).toBe(0);
  });

  it("maps private content to a terminal error", async () => {
    const [landing, privateHtml] = await Promise.all([
      fixture("snaptik-monster-landing.html"),
      fixture("snaptik-monster-private.html")
    ]);
    let calls = 0;
    const provider = new SnapTikMonsterProvider({
      enabled: true,
      fetchImpl: async (request) => {
        calls += 1;
        return htmlResponse(calls === 1 ? landing : privateHtml, request.toString());
      }
    });
    await expect(provider.resolve(input)).rejects.toMatchObject({
      failureCode: "content_private",
      retryable: false,
      fallbackAllowed: false
    });
  });

  it("maps removed content to a terminal error", async () => {
    const [landing, notFoundHtml] = await Promise.all([
      fixture("snaptik-monster-landing.html"),
      fixture("snaptik-monster-not-found.html")
    ]);
    let calls = 0;
    const provider = new SnapTikMonsterProvider({
      enabled: true,
      fetchImpl: async (request) => {
        calls += 1;
        return htmlResponse(calls === 1 ? landing : notFoundHtml, request.toString());
      }
    });
    await expect(provider.resolve(input)).rejects.toMatchObject({
      failureCode: "content_not_found",
      retryable: false,
      fallbackAllowed: false
    });
  });

  it("maps an empty result to a retryable fallback error", async () => {
    const [landing, emptyHtml] = await Promise.all([
      fixture("snaptik-monster-landing.html"),
      fixture("snaptik-monster-empty.html")
    ]);
    let calls = 0;
    const provider = new SnapTikMonsterProvider({
      enabled: true,
      fetchImpl: async (request) => {
        calls += 1;
        return htmlResponse(calls === 1 ? landing : emptyHtml, request.toString());
      }
    });
    await expect(provider.resolve(input)).rejects.toMatchObject({
      failureCode: "invalid_result",
      retryable: true,
      fallbackAllowed: true
    });
  });

  it("fails closed for missing tokens, unreviewed media hosts, challenges and rate limits", async () => {
    const missingToken = new SnapTikMonsterProvider({
      enabled: true,
      fetchImpl: async (request) => htmlResponse("<form></form>", request.toString())
    });
    await expect(missingToken.resolve(input)).rejects.toMatchObject({
      failureCode: "provider_schema_changed",
      fallbackAllowed: true
    });

    const changedHost = new SnapTikMonsterProvider({
      enabled: true,
      fetchImpl: async (request) => htmlResponse(
        '<input name="_csrf" value="fixture-csrf-token-123"><a href="https://evil.example.test/video.mp4">Download video HD</a>',
        request.toString()
      )
    });
    await expect(changedHost.resolve(input)).rejects.toMatchObject({
      failureCode: "invalid_result",
      fallbackAllowed: true
    });

    const challenge = new SnapTikMonsterProvider({
      enabled: true,
      fetchImpl: async (request) => htmlResponse(
        "<title>Attention Required</title><div class=cf-turnstile></div>",
        request.toString()
      )
    });
    await expect(challenge.resolve(input)).rejects.toMatchObject({
      failureCode: "provider_challenge",
      fallbackAllowed: true
    });

    const rateLimited = new SnapTikMonsterProvider({
      enabled: true,
      fetchImpl: async (request) => htmlResponse("", request.toString(), { status: 429 })
    });
    await expect(rateLimited.resolve(input)).rejects.toMatchObject({
      failureCode: "provider_rate_limited",
      retryable: true,
      fallbackAllowed: true
    });
  });
});
