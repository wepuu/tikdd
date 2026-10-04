import { describe, expect, it, vi } from "vitest";
import type { ResolverProvider } from "@tikdd/providers";
import {
  YTDLP_QUALIFICATION_INTERVAL_MS,
  assertYtDlpQualificationTrafficIsolation,
  parseYtDlpQualificationPlan,
  runYtDlpQualification
} from "../src/ytdlp-qualification";

const makeProvider = (): ResolverProvider => ({
  manifest: { id: "ytdlp-isolated", displayName: "yt-dlp", kind: "yt-dlp", enabled: true, regions: ["nl"], timeoutMs: 180_000, costWeight: 95, platforms: [] },
  resolve: vi.fn(async (input) => ({
    result: {
      schemaVersion: "1.0", source: { platform: input.platform, canonicalUrl: input.canonicalUrl },
      media: { id: "fixture", title: "fixture", author: null, thumbnailUrl: "https://i.ytimg.com/vi/fixture/hqdefault.jpg", durationSeconds: 10, isLive: false },
      formats: [{ id: "fmt_fixture", container: "mp4", mimeType: "video/mp4", quality: "360p", width: 640, height: 360,
        fps: null, bitrateKbps: null, estimatedBytes: null, videoCodec: "h264", audioCodec: "aac", hasVideo: true, hasAudio: true, mediaKind: "video" }],
      provenance: { provider: "ytdlp-isolated", kind: "yt-dlp", cacheHit: false, resolvedAt: new Date().toISOString() }, warnings: []
    },
    candidates: [{ formatId: "fmt_fixture", kind: "artifact", mode: "temporary-object", hostPolicyId: "ytdlp-youtube-artifact-v1",
      expiresAt: new Date(Date.now() + 60_000).toISOString(), artifact: { id: `yta_${"a".repeat(32)}`, sizeBytes: 1024,
        sha256: "b".repeat(64), mimeType: "video/mp4", filename: "TikDD-YouTube-fixture-360p.mp4" } }]
  }))
});

describe("yt-dlp YouTube qualification", () => {
  it("accepts at most two YouTube samples and rejects other platforms", () => {
    const plan = parseYtDlpQualificationPlan({ capability: "artifact", samples: [
      { id: "ordinary", url: "https://www.youtube.com/watch?v=fixture" },
      { id: "shorts", url: "https://www.youtube.com/shorts/fixture" }
    ] });
    expect(plan.samples).toHaveLength(2);
    expect(() => parseYtDlpQualificationPlan({ capability: "artifact", samples: [
      { id: "bad", url: "https://www.dailymotion.com/video/fixture" }
    ] })).toThrow(/YouTube samples only/);
  });

  it("refuses to qualify an active YouTube capability", () => {
    const plan = parseYtDlpQualificationPlan({ capability: "direct", samples: [{ id: "ordinary", url: "https://www.youtube.com/watch?v=fixture" }] });
    expect(() => assertYtDlpQualificationTrafficIsolation(plan, { approvedPlatforms: "dailymotion,youtube" }))
      .toThrow(/active Worker/);
    expect(() => assertYtDlpQualificationTrafficIsolation(plan, { approvedPlatforms: "dailymotion", verifiedCapabilities: "youtube:artifact" }))
      .toThrow(/active Worker/);
    expect(() => assertYtDlpQualificationTrafficIsolation(plan, { approvedPlatforms: "dailymotion", verifiedCapabilities: "dailymotion:artifact" }))
      .not.toThrow();
  });

  it("runs samples sequentially and emits only sanitized resolution facts", async () => {
    const plan = parseYtDlpQualificationPlan({ capability: "artifact", samples: [
      { id: "ordinary", url: "https://www.youtube.com/watch?v=fixture" },
      { id: "shorts", url: "https://www.youtube.com/shorts/fixture" }
    ] });
    const sleeps: number[] = [];
    const results = await runYtDlpQualification(plan, {
      apiUrl: "http://ytdlp-runner:9100/", hmacSecret: "s".repeat(32),
      sleep: async (milliseconds) => { sleeps.push(milliseconds); }, providerFactory: () => makeProvider()
    });
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ outcome: "resolved", capability: "artifact", formatCount: 1,
      hostPolicyIds: ["ytdlp-youtube-artifact-v1"], deliveryModes: ["temporary-object"], thumbnailStatus: "accepted" });
    expect(sleeps).toEqual([YTDLP_QUALIFICATION_INTERVAL_MS]);
    const serialized = JSON.stringify(results);
    expect(serialized).not.toContain("youtube.com");
    expect(serialized).not.toContain("yta_");
    expect(serialized).not.toContain("hqdefault");
  });
});
