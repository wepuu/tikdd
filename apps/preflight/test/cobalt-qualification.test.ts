import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResolverProvider } from "@tikdd/providers";
import {
  assertCobaltQualificationTrafficIsolation,
  parseCobaltQualificationPlan,
  runCobaltQualification,
  writeCobaltQualificationTunnelArtifact
} from "../src/cobalt-qualification";

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
        candidates: [{ formatId: "fmt_fixture", kind: "target", mode: "proxy", hostPolicyId: "cobalt-selfhosted-tunnel-media-v1", expiresAt: new Date(Date.now() + 60_000).toISOString(), targetUrl: "https://media.tikdd.cc/tunnel?id=secret", secretHeaders: {} }]
      }))
    };
    const plan = parseCobaltQualificationPlan({ samples: [{ id: "tiktok-a", platform: "tiktok", url: sourceUrl }] });
    const tunnelArtifactSink = vi.fn();
    const results = await runCobaltQualification(plan, {
      apiUrl: "http://cobalt-api:9000/",
      apiKey: "secret-key",
      sleep: async () => undefined,
      providerFactory: () => provider,
      tunnelArtifactSink
    });
    const serialized = JSON.stringify(results);
    expect(results[0]).toMatchObject({ outcome: "resolved", candidateCount: 1, hostPolicyIds: ["cobalt-selfhosted-tunnel-media-v1"] });
    expect(serialized).not.toContain(sourceUrl);
    expect(serialized).not.toContain("secret-key");
    expect(serialized).not.toContain("id=secret");
    expect(tunnelArtifactSink).toHaveBeenCalledWith([
      { id: "tiktok-a", url: "https://media.tikdd.cc/tunnel?id=secret" }
    ]);
  });

  it("refuses to qualify a platform already active in Worker configuration", () => {
    const plan = parseCobaltQualificationPlan({ samples: [
      { id: "dailymotion-a", platform: "dailymotion", url: "https://www.dailymotion.com/video/fixture-a" }
    ] });
    expect(() => assertCobaltQualificationTrafficIsolation(plan, {
      approvedPlatforms: "tiktok,dailymotion",
      verifiedCapabilities: "tiktok:tunnel"
    })).toThrow(/active in Worker/);
    expect(() => assertCobaltQualificationTrafficIsolation(plan, {
      approvedPlatforms: "tiktok",
      verifiedCapabilities: "dailymotion:tunnel"
    })).toThrow(/active in Worker/);
    expect(() => assertCobaltQualificationTrafficIsolation(plan, {
      approvedPlatforms: "tiktok",
      verifiedCapabilities: "tiktok:tunnel"
    })).not.toThrow();
  });

  it("writes a bounded mode-600 artifact without qualification source URLs", () => {
    const directory = mkdtempSync(join(tmpdir(), "tikdd-wi138-"));
    const path = join(directory, "artifact.json");
    const exp = String(Date.now() + 120_000);
    const url = `https://media.tikdd.cc/tunnel?id=${"a".repeat(21)}&exp=${exp}&sig=${"b".repeat(43)}&sec=${"c".repeat(43)}&iv=${"d".repeat(22)}`;
    try {
      writeCobaltQualificationTunnelArtifact(path, [{ id: "dailymotion-a", url }]);
      expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
        schemaVersion: "1.0",
        samples: [{ id: "dailymotion-a", url }]
      });
      if (process.platform !== "win32") expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(readFileSync(path, "utf8")).not.toContain("dailymotion.com/video");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("refuses to write more than two tunnel descriptors", () => {
    const directory = mkdtempSync(join(tmpdir(), "tikdd-wi138-limit-"));
    const path = join(directory, "artifact.json");
    const exp = String(Date.now() + 120_000);
    const makeUrl = (id: string) => `https://media.tikdd.cc/tunnel?id=${id.repeat(21)}&exp=${exp}&sig=${"b".repeat(43)}&sec=${"c".repeat(43)}&iv=${"d".repeat(22)}`;
    try {
      expect(() => writeCobaltQualificationTunnelArtifact(path, [
        { id: "dailymotion-a", url: makeUrl("a") },
        { id: "dailymotion-b", url: makeUrl("e") },
        { id: "dailymotion-c", url: makeUrl("f") }
      ])).toThrow(/one or two samples/i);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
