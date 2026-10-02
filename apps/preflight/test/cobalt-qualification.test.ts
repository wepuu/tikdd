import { describe, expect, it, vi } from "vitest";
import type { ResolverProvider } from "@tikdd/providers";
import { parseCobaltQualificationPlan, runCobaltQualification } from "../src/cobalt-qualification";

describe("Cobalt multimode qualification", () => {
  it("accepts two reviewed samples per platform and rejects host mismatches", () => {
    const plan = parseCobaltQualificationPlan({ samples: [
      { id: "tiktok-a", platform: "tiktok", url: "https://www.tiktok.com/@fixture/video/1?utm_source=test" },
      { id: "tiktok-b", platform: "tiktok", url: "https://www.tiktok.com/@fixture/video/2" }
    ] });
    expect(plan.samples[0]?.canonicalUrl).not.toContain("utm_source");
    expect(() => parseCobaltQualificationPlan({ samples: [
      { id: "bad", platform: "tiktok", url: "https://instagram.com/reel/fixture/" }
    ] })).toThrow(/does not match/);
  });

  it("accepts the reviewed WI137 platform batch and rejects a spoofed VK Video host", () => {
    const plan = parseCobaltQualificationPlan({ samples: [
      { id: "dailymotion-a", platform: "dailymotion", url: "https://www.dailymotion.com/video/fixture-a" },
      { id: "reddit-a", platform: "reddit", url: "https://www.reddit.com/r/fixture/comments/fixture/" },
      { id: "vk-a", platform: "vk", url: "https://vkvideo.ru/video-1_2" }
    ] });
    expect(plan.samples.map(({ platform }) => platform)).toEqual(["dailymotion", "reddit", "vk"]);
    expect(() => parseCobaltQualificationPlan({ samples: [
      { id: "vk-spoof", platform: "vk", url: "https://vkvideo.ru.attacker.example/video-1_2" }
    ] })).toThrow();
  });

  it("emits only sanitized result metadata", async () => {
    const sourceUrl = "https://www.tiktok.com/@fixture/video/123456789";
    const provider: ResolverProvider = {
      manifest: { id: "cobalt-selfhosted", displayName: "Cobalt", kind: "api", enabled: true, regions: ["nl"], timeoutMs: 15_000, costWeight: 80, platforms: [] },
      resolve: vi.fn(async (input) => ({
        result: {
          schemaVersion: "1.0",
          source: { platform: input.platform, canonicalUrl: input.canonicalUrl },
          media: { id: "fixture", title: "fixture", author: null, thumbnailUrl: null, durationSeconds: null, isLive: false },
          formats: [{ id: "fmt_fixture", container: "mp4", mimeType: "video/mp4", quality: "720p", width: null, height: 720, fps: null, bitrateKbps: null, estimatedBytes: null, videoCodec: null, audioCodec: null, hasVideo: true, hasAudio: true, mediaKind: "video" }],
          provenance: { provider: "cobalt-selfhosted", kind: "api", cacheHit: false, resolvedAt: new Date().toISOString() },
          warnings: []
        },
        candidates: [{ formatId: "fmt_fixture", kind: "target", mode: "redirect", hostPolicyId: "cobalt-selfhosted-tunnel-media-v1", expiresAt: new Date(Date.now() + 60_000).toISOString(), targetUrl: "https://media.tikdd.cc/tunnel?id=secret", secretHeaders: {} }]
      }))
    };
    const plan = parseCobaltQualificationPlan({ samples: [{ id: "tiktok-a", platform: "tiktok", url: sourceUrl }] });
    const results = await runCobaltQualification(plan, {
      apiUrl: "http://cobalt-api:9000/",
      apiKey: "secret-key",
      sleep: async () => undefined,
      providerFactory: () => provider
    });
    const serialized = JSON.stringify(results);
    expect(results[0]).toMatchObject({ outcome: "resolved", candidateCount: 1, hostPolicyIds: ["cobalt-selfhosted-tunnel-media-v1"] });
    expect(serialized).not.toContain(sourceUrl);
    expect(serialized).not.toContain("secret-key");
    expect(serialized).not.toContain("id=secret");
  });
});
