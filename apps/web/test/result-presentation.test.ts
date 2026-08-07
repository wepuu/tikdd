import type { ResolveResult } from "@tikdd/contracts";
import { describe, expect, it } from "vitest";
import { formatMediaDuration, publicResultTitle } from "../lib/result-presentation";

function result(overrides: Partial<ResolveResult> = {}): ResolveResult {
  return {
    schemaVersion: "1.0",
    source: { platform: "x", canonicalUrl: "https://x.com/example/status/1" },
    media: {
      id: "media-1",
      title: "A public post",
      author: null,
      thumbnailUrl: null,
      durationSeconds: null,
      isLive: false
    },
    formats: [{
      id: "format-1",
      container: "mp4",
      mimeType: "video/mp4",
      quality: "Source quality",
      width: null,
      height: null,
      fps: null,
      bitrateKbps: null,
      estimatedBytes: null,
      videoCodec: null,
      audioCodec: null,
      hasVideo: true,
      hasAudio: true
    }],
    provenance: { provider: "provider-a", kind: "site-adapter", cacheHit: false, resolvedAt: "2026-08-07T00:00:00.000Z" },
    warnings: [],
    ...overrides
  };
}

describe("result presentation", () => {
  it("preserves a consumer-facing title from a real provider", () => {
    expect(publicResultTitle(result(), "Resolved media")).toBe("A public post");
  });

  it("hides mock and provider-flavored development titles", () => {
    const mockResult = result({
      media: { ...result().media, title: "Development provider result" },
      provenance: { provider: "mock", kind: "mock", cacheHit: false, resolvedAt: "2026-08-07T00:00:00.000Z" }
    });
    expect(publicResultTitle(mockResult, "Resolved media")).toBe("Resolved media");
  });

  it("formats short and long durations without locale-specific provider data", () => {
    expect(formatMediaDuration(null)).toBeNull();
    expect(formatMediaDuration(167)).toBe("2:47");
    expect(formatMediaDuration(3723)).toBe("1:02:03");
  });
});
