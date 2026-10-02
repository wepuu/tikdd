import { describe, expect, it } from "vitest";
import { YtDlpIsolatedProvider } from "../src/adapters/ytdlp-isolated";

const secret = "provider-runner-secret-that-is-long-enough";
const input = { taskId: "tsk_0123456789abcdef0123456789abcdef", sourceUrl: "https://www.dailymotion.com/video/x123",
  canonicalUrl: "https://www.dailymotion.com/video/x123", platform: "dailymotion" as const };
const payload = { platform: "dailymotion", sourceId: "x123", title: "Example", author: null, thumbnailUrl: null,
  durationSeconds: 30, isLive: false, extractor: "Dailymotion", formats: [{ sourceFormatId: "http-720", container: "mp4",
    protocol: "https", quality: "720p", width: 1280, height: 720, fps: 30, bitrateKbps: 800, estimatedBytes: 1000,
    videoCodec: "h264", audioCodec: "aac", hasVideo: true, hasAudio: true,
    targetUrl: "https://vod-progressive.akamaized.net/example.mp4", headers: { Referer: "https://www.dailymotion.com/" } }] };

describe("YtDlpIsolatedProvider", () => {
  it("stays routing-ineligible until a delivery capability is explicitly approved", () => {
    const provider = new YtDlpIsolatedProvider({ approvedPlatforms: ["dailymotion"] });
    expect(provider.manifest.platforms.find(({ platform }) => platform === "dailymotion")?.deliveryModes).toEqual([]);
  });
  it("creates a bounded relay candidate without exposing its target in the result", async () => {
    const provider = new YtDlpIsolatedProvider({ enabled: true, hmacSecret: secret, approvedPlatforms: ["dailymotion"],
      deliveryVerifiedCapabilities: { dailymotion: "relay" }, fetchImpl: async (_url, init) => {
        expect(new Headers(init?.headers).get("x-tikdd-signature")).toMatch(/^[A-Za-z0-9_-]{43}$/);
        return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
      } });
    const resolved = await provider.resolve(input);
    expect(resolved.result.formats).toHaveLength(1);
    expect(JSON.stringify(resolved.result)).not.toContain("akamaized");
    expect(resolved.candidates[0]).toMatchObject({ mode: "proxy", hostPolicyId: "ytdlp-dailymotion-relay-v1" });
  });
  it("does not normalize separated audio and video into a progressive download", async () => {
    const separated = { ...payload, formats: payload.formats.map((format) => ({ ...format, hasAudio: false, audioCodec: null })) };
    const provider = new YtDlpIsolatedProvider({ enabled: true, hmacSecret: secret, approvedPlatforms: ["dailymotion"],
      deliveryVerifiedCapabilities: { dailymotion: "direct" }, fetchImpl: async () => new Response(JSON.stringify(separated), { status: 200 }) });
    await expect(provider.resolve(input)).rejects.toMatchObject({ failureCode: "invalid_result" });
  });
});
