import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  YtDlpArtifactRequestSchema,
  YtDlpArtifactResponseSchema,
  YtDlpRunnerErrorResponseSchema,
  YtDlpRunnerRequestSchema,
  YtDlpRunnerResponseSchema
} from "../src";

describe("yt-dlp Runner internal contract", () => {
  it("keeps the internal OpenAPI boundary synchronized", () => {
    const openapi = readFileSync(new URL("../../../openapi/ytdlp-runner.internal.yaml", import.meta.url), "utf8");
    expect(openapi).toContain("enum: [dailymotion, youtube]");
    expect(openapi).toContain("name: x-tikdd-timestamp");
    expect(openapi).toContain("$ref: \"#/components/schemas/ExtractionResponse\"");
    expect(openapi).toContain("$ref: \"#/components/schemas/ArtifactResponse\"");
    expect(openapi).toContain("po_token_required");
  });

  it("accepts only bounded, opaque temporary artifact metadata", () => {
    expect(YtDlpArtifactRequestSchema.parse({
      requestId: "req-2", platform: "dailymotion",
      url: "https://www.dailymotion.com/video/example",
      deadlineMs: 175_000, maximumHeight: 720
    }).maximumHeight).toBe(720);
    expect(YtDlpArtifactResponseSchema.parse({
      platform: "dailymotion", sourceId: "example", title: "Public video", author: null,
      thumbnailUrl: null, durationSeconds: 30, isLive: false, extractor: "Dailymotion",
      artifact: { id: `yta_${"a".repeat(32)}`, container: "mp4", mimeType: "video/mp4",
        quality: "720p", width: 1280, height: 720, sizeBytes: 1024,
        sha256: "b".repeat(64), expiresAt: "2030-01-01T00:00:00.000Z" }
    }).artifact.sizeBytes).toBe(1024);
    expect(() => YtDlpArtifactResponseSchema.parse({
      platform: "dailymotion", sourceId: "../escape", title: "bad", author: null,
      thumbnailUrl: null, durationSeconds: null, isLive: false, extractor: "Dailymotion",
      artifact: { id: "../../video", container: "mp4", mimeType: "video/mp4", quality: "720p",
        width: null, height: 720, sizeBytes: 1, sha256: "b".repeat(64), expiresAt: "2030-01-01T00:00:00.000Z" }
    })).toThrow();
  });
  it("accepts a bounded normalized extraction response", () => {
    expect(YtDlpRunnerResponseSchema.parse({
      platform: "dailymotion",
      sourceId: "video-id",
      title: "Public video",
      author: null,
      thumbnailUrl: null,
      durationSeconds: 30,
      isLive: false,
      extractor: "Dailymotion",
      formats: [{
        sourceFormatId: "http-720",
        container: "mp4",
        protocol: "https",
        quality: "720p",
        width: 1280,
        height: 720,
        fps: 30,
        bitrateKbps: null,
        estimatedBytes: null,
        videoCodec: "h264",
        audioCodec: "aac",
        hasVideo: true,
        hasAudio: true,
        targetUrl: "https://media.example.test/video.mp4",
        headers: { Referer: "https://www.dailymotion.com/" }
      }]
    }).formats).toHaveLength(1);
  });

  it("rejects unknown platforms and unsafe headers", () => {
    expect(() => YtDlpRunnerRequestSchema.parse({
      requestId: "req-1",
      platform: "generic",
      url: "https://example.test/video",
      deadlineMs: 30_000
    })).toThrow();
    expect(() => YtDlpRunnerResponseSchema.parse({
      platform: "youtube",
      sourceId: "id",
      title: "Video",
      author: null,
      thumbnailUrl: null,
      durationSeconds: null,
      isLive: false,
      extractor: "Youtube",
      formats: [{
        sourceFormatId: "18",
        container: "mp4",
        protocol: "https",
        quality: "360p",
        width: 640,
        height: 360,
        fps: 30,
        bitrateKbps: null,
        estimatedBytes: null,
        videoCodec: "h264",
        audioCodec: "aac",
        hasVideo: true,
        hasAudio: true,
        targetUrl: "https://media.example.test/video.mp4",
        headers: { Cookie: "secret" }
      }]
    })).toThrow();
  });

  it("accepts only sanitized Runner failure codes", () => {
    expect(YtDlpRunnerErrorResponseSchema.parse({ error: { code: "rate_limited" } })).toEqual({
      error: { code: "rate_limited" }
    });
    expect(() => YtDlpRunnerErrorResponseSchema.parse({ error: { code: "raw_stderr" } })).toThrow();
  });
});
