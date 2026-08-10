import type { ResolveTask } from "@tikdd/contracts";
import { describe, expect, it } from "vitest";
import { toPublicResolveTask } from "../src/public-task";

const task: ResolveTask = {
  id: "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  status: "succeeded",
  platform: "x",
  canonicalUrl: "https://x.com/authorized/status/123",
  result: {
    schemaVersion: "1.0",
    source: { platform: "x", canonicalUrl: "https://x.com/authorized/status/123" },
    media: {
      id: "media-1",
      title: "Authorized public fixture",
      author: null,
      thumbnailUrl: null,
      durationSeconds: null,
      isLive: false
    },
    formats: [
      {
        id: "fmt_fixture",
        container: "mp4",
        mimeType: "video/mp4",
        quality: "720p",
        width: null,
        height: 720,
        fps: null,
        bitrateKbps: null,
        estimatedBytes: null,
        videoCodec: null,
        audioCodec: null,
        hasVideo: true,
        hasAudio: true
      }
    ],
    provenance: {
      provider: "ssstwitter",
      kind: "site-adapter",
      cacheHit: true,
      resolvedAt: "2026-08-10T12:00:00.000Z"
    },
    warnings: ["Provider fallback used."]
  },
  error: null,
  createdAt: "2026-08-10T12:00:00.000Z",
  updatedAt: "2026-08-10T12:00:01.000Z",
  expiresAt: "2026-08-11T12:00:00.000Z"
};

describe("public task projection", () => {
  it("removes provider identity, internal kind, cache state, and warnings", () => {
    const publicTask = toPublicResolveTask(task);
    expect(publicTask.result?.provenance).toEqual({
      provider: "tikdd",
      kind: "api",
      cacheHit: false,
      resolvedAt: "2026-08-10T12:00:00.000Z"
    });
    expect(publicTask.result?.warnings).toEqual([]);
    expect(JSON.stringify(publicTask)).not.toContain("ssstwitter");
    expect(JSON.stringify(publicTask)).not.toContain("fallback");
  });

  it("preserves pending tasks without inventing result state", () => {
    const pending = toPublicResolveTask({ ...task, status: "queued", result: null });
    expect(pending.result).toBeNull();
  });
});
