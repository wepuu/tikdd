import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PinterestVideoDownloaderProvider,
  parsePinterestVideoDownloaderResponse,
  type ResolveInput
} from "../src/index";

const fixture = (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const input: ResolveInput = {
  taskId: "tsk_5123456789abcdef0123456789abcdef",
  sourceUrl: "https://pin.it/fixture",
  canonicalUrl: "https://pin.it/fixture",
  platform: "pinterest"
};

function jsonResponse(body: string, status = 200, url = "https://pinterest-videodownloader.com/api/pin?id=fixture") {
  const response = new Response(body, { status, headers: { "content-type": "application/json" } });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("Pinterest Video Downloader adapter", () => {
  it("expands a pin.it URL and returns an opaque v1.pinimg.com delivery candidate", async () => {
    const responseBody = await fixture("pinterest-videodownloader-success.json");
    const expandBody = await fixture("pinterest-videodownloader-expand.json");
    const calls: string[] = [];
    const provider = new PinterestVideoDownloaderProvider({
      enabled: true,
      fetchImpl: async (url) => {
        calls.push(url.toString());
        return new URL(url.toString()).pathname === "/api/expand"
          ? jsonResponse(expandBody, 200, url.toString())
          : jsonResponse(responseBody, 200, url.toString());
      }
    });
    const resolution = await provider.resolve(input);
    expect(calls).toHaveLength(2);
    expect(new URL(calls[0]!).pathname).toBe("/api/expand");
    expect(new URL(calls[1]!).searchParams.get("id")).toBe("845550898836992004");
    expect(resolution.result.media.thumbnailUrl).toContain("i.pinimg.com");
    expect(resolution.result.formats[0]).toMatchObject({ container: "mp4", hasVideo: true });
    expect(resolution.candidates[0]).toMatchObject({
      mode: "redirect",
      hostPolicyId: "pinterest-videodownloader-pinterest-media-v1"
    });
    expect(JSON.stringify(resolution.result)).not.toContain("v1.pinimg.com");
    expect(JSON.stringify(resolution.candidates)).toContain("v1.pinimg.com");
  });

  it("accepts a canonical Pinterest pin without expansion", async () => {
    const body = await fixture("pinterest-videodownloader-success.json");
    const calls: string[] = [];
    const provider = new PinterestVideoDownloaderProvider({
      enabled: true,
      fetchImpl: async (url) => {
        calls.push(url.toString());
        return jsonResponse(body, 200, url.toString());
      }
    });
    await provider.resolve({
      ...input,
      sourceUrl: "https://www.pinterest.com/pin/845550898836992004/",
      canonicalUrl: "https://www.pinterest.com/pin/845550898836992004/"
    });
    expect(calls).toHaveLength(1);
  });

  it("rejects unreviewed media hosts and malformed responses", async () => {
    expect(() => parsePinterestVideoDownloaderResponse(JSON.stringify({
      type: "video",
      video_url: "https://evil.example.test/video.mp4"
    }))).toThrow(/no reviewed MP4/i);
    expect(() => parsePinterestVideoDownloaderResponse(JSON.stringify({ type: "image" })))
      .toThrow(/no reviewed MP4/i);
    expect(() => parsePinterestVideoDownloaderResponse("not-json"))
      .toThrow(/invalid response/i);
  });
});
