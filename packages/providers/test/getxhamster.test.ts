import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GetXHamsterProvider,
  parseGetXHamsterResponse,
  type ResolveInput
} from "../src/index";

const fixture = (name: string) => readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
const input: ResolveInput = {
  taskId: "tsk_5123456789abcdef0123456789abcdef",
  sourceUrl: "https://xhamster.com/videos/fixture-video",
  canonicalUrl: "https://xhamster.com/videos/fixture-video",
  platform: "xhamster"
};

function response(body: string, status = 200, contentType = "application/json") {
  const value = new Response(body, { status, headers: { "content-type": contentType } });
  Object.defineProperty(value, "url", { value: "https://getxhamster.com/api/video" });
  return value;
}

describe("GetXHamster xHamster adapter", () => {
  it("parses progressive MP4 media and ignores adaptive streams and Provider proxy URLs", async () => {
    const body = await fixture("getxhamster-success.json");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const provider = new GetXHamsterProvider({
      enabled: true,
      minIntervalMs: 0,
      fetchImpl: async (url, init) => {
        calls.push({ url: url.toString(), init: init ?? {} });
        return response(body);
      }
    });
    const resolution = await provider.resolve(input);
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!.url).searchParams.get("u")).toBe(input.canonicalUrl);
    expect(resolution.result.formats).toHaveLength(4);
    expect(resolution.result.formats.map((format) => format.quality)).toEqual(["720p", "480p", "240p", "144p"]);
    expect(resolution.result.media.thumbnailUrl).toBeNull();
    expect(resolution.candidates).toHaveLength(4);
    expect(resolution.candidates[0]).toMatchObject({
      hostPolicyId: "getxhamster-xhamster-media-v1",
      mode: "redirect"
    });
    expect(JSON.stringify(resolution.result)).not.toContain("xhcdn.com");
    expect(JSON.stringify(resolution.result)).not.toContain("/f?");
    expect(JSON.stringify(resolution.candidates)).toContain("xhcdn.com");
  });

  it("accepts the ahcdn redirect target and deduplicates media URLs", () => {
    const parsed = parseGetXHamsterResponse(JSON.stringify({
      media: [
        { quality: "720", url: "https://video7.xhcdn.com/fixture/video.mp4" },
        { quality: "720p", url: "https://video7.xhcdn.com/fixture/video.mp4" },
        { quality: "720p", url: "https://ip123.ahcdn.com/fixture/video.mp4" }
      ]
    }));
    expect(parsed.formats).toHaveLength(2);
    expect(parsed.formats[0]?.quality).toBe("720p");
  });

  it("rejects bare, spoofed, non-HTTPS, credentialed, non-MP4 and Provider proxy URLs", () => {
    expect(() => parseGetXHamsterResponse(JSON.stringify({
      media: [
        { url: "https://xhcdn.com/fixture/video.mp4" },
        { url: "https://video7.xhcdn.com.attacker.example/fixture/video.mp4" },
        { url: "http://video7.xhcdn.com/fixture/video.mp4" },
        { url: "https://user:pass@video7.xhcdn.com/fixture/video.mp4" },
        { url: "https://video7.xhcdn.com:8443/fixture/video.mp4" },
        { url: "https://video7.xhcdn.com/f?token=fixture" },
        { url: "https://ip123.ahcdn.com/fixture/video.webm" }
      ]
    }))).toThrow(expect.objectContaining({ failureCode: "invalid_result" }));
  });

  it("classifies the real invalid-url error shape as terminal unsupported content", () => {
    expect(() => parseGetXHamsterResponse(JSON.stringify({
      error: "That link is not from xHamster."
    }))).toThrow(expect.objectContaining({ failureCode: "unsupported_url", retryable: false }));
  });

  it.each([
    JSON.stringify({ media: [], streams: [{ playlist: "https://video7.xhcdn.com/fixture/stream.m3u8" }] }),
    JSON.stringify({ title: "missing media" }),
    "not-json"
  ])("rejects responses without progressive MP4 media", (body) => {
    expect(() => parseGetXHamsterResponse(body)).toThrow();
  });

  it("bounds repeated requests with a configurable spacing gate", async () => {
    const provider = new GetXHamsterProvider({
      enabled: true,
      minIntervalMs: 60_000,
      fetchImpl: async () => response(JSON.stringify({ media: [{ quality: "720p", url: "https://video7.xhcdn.com/fixture/video.mp4" }] }))
    });
    await provider.resolve(input);
    await expect(provider.resolve({ ...input, taskId: "tsk_6123456789abcdef0123456789abcdef" })).rejects.toMatchObject({
      failureCode: "provider_rate_limited",
      retryable: true,
      fallbackAllowed: true
    });
  });

  it("keeps non-reviewed platform capabilities out of the manifest", () => {
    expect(() => new GetXHamsterProvider({ enabled: true, approvedPlatforms: ["tiktok"] })).toThrow(/does not support/i);
    const provider = new GetXHamsterProvider({ enabled: true, deliveryVerifiedPlatforms: [] });
    expect(provider.manifest.platforms[0]).toMatchObject({ platform: "xhamster", deliveryModes: [] });
  });

  it("marks the reviewed xHamster binding delivery verified", () => {
    const provider = new GetXHamsterProvider({ enabled: true, deliveryVerifiedPlatforms: ["xhamster"] });
    expect(provider.manifest.platforms[0]).toMatchObject({
      deliveryModes: ["redirect"],
      verificationStatus: "delivery_verified"
    });
  });
});
