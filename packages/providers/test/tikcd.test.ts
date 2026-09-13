import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TikCDProvider, type ResolveInput } from "../src/index";

const input: ResolveInput = {
  taskId: "tsk_5123456789abcdef0123456789abcdef",
  sourceUrl: "https://www.tiktok.com/@fixture/video/7615724915156667679",
  canonicalUrl: "https://www.tiktok.com/@fixture/video/7615724915156667679",
  platform: "tiktok"
};

const apiUrl = "https://tikwm.com/api/";
const fixture = (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

function jsonResponse(body: string, status = 200): Response {
  const response = new Response(body, { status, headers: { "content-type": "application/json" } });
  Object.defineProperty(response, "url", { value: apiUrl });
  return response;
}

describe("TikCD technical adapter", () => {
  it("normalizes API MP4 resources into opaque delivery candidates", async () => {
    const responseBody = await fixture("tikcd-success.json");
    const calls: string[] = [];
    const provider = new TikCDProvider({
      enabled: true,
      fetchImpl: async (url) => {
        calls.push(url.toString());
        return jsonResponse(responseBody);
      }
    });
    const resolution = await provider.resolve(input);
    expect(calls).toHaveLength(1);
    const requestUrl = new URL(calls[0]!);
    expect(requestUrl.hostname).toBe("tikwm.com");
    expect(requestUrl.pathname).toBe("/api/");
    expect(requestUrl.searchParams.get("url")).toBe(input.canonicalUrl);
    expect(requestUrl.searchParams.get("hd")).toBe("1");
    expect(resolution.result.formats).toHaveLength(2);
    expect(resolution.result.formats[0]).toMatchObject({ container: "mp4", hasVideo: true });
    expect(resolution.candidates).toEqual([]);
    expect(JSON.stringify(resolution.result)).not.toContain("tiktokcdn-us.com");
  });

  it("rejects non-zero API results and unreviewed media hosts", async () => {
    const errorBody = await fixture("tikcd-error.json");
    const unavailable = new TikCDProvider({ enabled: true, fetchImpl: async () => jsonResponse(errorBody) });
    await expect(unavailable.resolve(input)).rejects.toMatchObject({ failureCode: "provider_unavailable", fallbackAllowed: true });

    const unsafe = new TikCDProvider({
      enabled: true,
      fetchImpl: async () => jsonResponse(JSON.stringify({ code: 0, data: { play: "https://evil.example.test/video.mp4" } }))
    });
    await expect(unsafe.resolve(input)).rejects.toMatchObject({ failureCode: "invalid_result" });

    const noMediaBody = await fixture("tikcd-no-media.json");
    const noMedia = new TikCDProvider({ enabled: true, fetchImpl: async () => jsonResponse(noMediaBody) });
    await expect(noMedia.resolve(input)).rejects.toMatchObject({ failureCode: "invalid_result" });
  });
});
