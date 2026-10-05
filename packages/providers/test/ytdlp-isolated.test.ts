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
  it("normalizes one prepared artifact without exposing its id or server path publicly", async () => {
    const provider = new YtDlpIsolatedProvider({ enabled: true, hmacSecret: secret, approvedPlatforms: ["dailymotion"],
      deliveryVerifiedCapabilities: { dailymotion: "artifact" }, fetchImpl: async (url, init) => {
        expect(url.toString()).toContain("/internal/v1/artifacts");
        expect(JSON.parse(String(init?.body))).toMatchObject({ maximumHeight: 720, deadlineMs: 175_000 });
        return new Response(JSON.stringify({ platform: "dailymotion", sourceId: "x123", title: "Example", author: null,
          thumbnailUrl: "https://s1.dmcdn.net/v/fixture/x720.jpg", durationSeconds: 30, isLive: false, extractor: "Dailymotion",
          artifact: { id: `yta_${"a".repeat(32)}`, container: "mp4", mimeType: "video/mp4", quality: "720p",
            width: 1280, height: 720, sizeBytes: 1024, sha256: "b".repeat(64),
            expiresAt: new Date(Date.now() + 600_000).toISOString() } }), { status: 200 });
      } });
    const resolved = await provider.resolve(input);
    expect(resolved.result.media.thumbnailUrl).toBe("https://s1.dmcdn.net/v/fixture/x720.jpg");
    expect(resolved.candidates[0]).toMatchObject({ kind: "artifact", mode: "temporary-object",
      hostPolicyId: "ytdlp-dailymotion-artifact-v1",
      artifact: { filename: "TikDD-Dailymotion-x123-720p.mp4" } });
    expect(JSON.stringify(resolved.result)).not.toContain("yta_");
    expect(provider.manifest.timeoutMs).toBe(180_000);
  });

  it("uses the platform label for a YouTube artifact candidate", async () => {
    const provider = new YtDlpIsolatedProvider({ enabled: true, hmacSecret: secret, approvedPlatforms: ["youtube"],
      deliveryVerifiedCapabilities: { youtube: "artifact" }, fetchImpl: async () => new Response(JSON.stringify({
        platform: "youtube", sourceId: "short-fixture", title: "Example", author: null,
        thumbnailUrl: "https://i.ytimg.com/vi/fixture/hqdefault.jpg", durationSeconds: 30, isLive: false, extractor: "Youtube",
        artifact: { id: `yta_${"c".repeat(32)}`, container: "mp4", mimeType: "video/mp4", quality: "360p",
          width: 640, height: 360, sizeBytes: 1024, sha256: "d".repeat(64),
          expiresAt: new Date(Date.now() + 600_000).toISOString() }
      }), { status: 200 }) });
    const resolved = await provider.resolve({ ...input, platform: "youtube",
      sourceUrl: "https://www.youtube.com/watch?v=fixture", canonicalUrl: "https://www.youtube.com/watch?v=fixture" });
    expect(resolved.candidates[0]).toMatchObject({ hostPolicyId: "ytdlp-youtube-artifact-v1",
      artifact: { filename: "TikDD-YouTube-short-fixture-360p.mp4" } });
    expect(resolved.result.media.thumbnailUrl).toBe("https://i.ytimg.com/vi/fixture/hqdefault.jpg");
  });

  it("preserves sanitized Runner rate-limit and challenge semantics", async () => {
    const rateLimited = new YtDlpIsolatedProvider({ enabled: true, hmacSecret: secret,
      approvedPlatforms: ["dailymotion"], deliveryVerifiedCapabilities: { dailymotion: "direct" },
      fetchImpl: async () => new Response(JSON.stringify({ error: { code: "rate_limited" } }), { status: 429 }) });
    await expect(rateLimited.resolve(input)).rejects.toMatchObject({ failureCode: "provider_rate_limited", retryable: true });

    const challenged = new YtDlpIsolatedProvider({ enabled: true, hmacSecret: secret,
      approvedPlatforms: ["dailymotion"], deliveryVerifiedCapabilities: { dailymotion: "direct" },
      fetchImpl: async () => new Response(JSON.stringify({ error: { code: "po_token_required" } }), { status: 422 }) });
    await expect(challenged.resolve(input)).rejects.toMatchObject({ failureCode: "provider_challenge", fallbackAllowed: true });
  });
});
