import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ProviderRouter, SnapTikMonsterProvider, TikCDProvider, type ResolveInput } from "../src/index";

const input: ResolveInput = {
  taskId: "tsk_5123456789abcdef0123456789abcdef",
  sourceUrl: "https://www.tiktok.com/@fixture/video/7615724915156667679",
  canonicalUrl: "https://www.tiktok.com/@fixture/video/7615724915156667679",
  platform: "tiktok"
};

const apiUrl = "https://tikwm.com/api/";
const fixture = (name: string) =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

function jsonResponse(body: string, status = 200, url = apiUrl): Response {
  const response = new Response(body, { status, headers: { "content-type": "application/json" } });
  Object.defineProperty(response, "url", { value: url });
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
    expect(resolution.candidates).toHaveLength(2);
    expect(resolution.candidates[0]).toMatchObject({
      mode: "redirect",
      hostPolicyId: "tikcd-tiktok-media-v1"
    });
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

  it("is reached only as a sequential fallback after SnapTik failure", async () => {
    const primary = new SnapTikMonsterProvider({
      enabled: true,
      fetchImpl: async (url) => jsonResponse("", 503, url.toString())
    });
    const secondary = new TikCDProvider({
      enabled: true,
      fetchImpl: async (url) => jsonResponse(await fixture("tikcd-success.json"), 200, url.toString())
    });
    const rollout = {
      async decide() {
        return { allowed: true, reason: "allowed" as const, ruleId: "wi54", snapshotRevision: 1, bucket: 0 };
      }
    };
    const routed = await new ProviderRouter([primary, secondary], {
      production: true,
      region: "nl",
      rolloutSource: rollout,
      maxAttempts: 2
    }).resolve(input);
    expect(routed.resolution.result.provenance.provider).toBe("tikcd");
    expect(routed.resolution.candidates).toHaveLength(2);
    expect(routed.attempts.map(({ providerId, status }) => [providerId, status])).toEqual([
      ["snaptik-monster", "failed"],
      ["tikcd", "succeeded"]
    ]);
  });
});
