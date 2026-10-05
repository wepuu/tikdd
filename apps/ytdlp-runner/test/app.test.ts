import { describe, expect, it } from "vitest";
import type { YtDlpRunnerResponse } from "@tikdd/contracts";
import { createYtDlpRunnerApp } from "../src/app";
import { signRunnerRequest } from "../src/auth";
import { YtDlpProcessError, type YtDlpCli } from "../src/cli";

const secret = "runner-test-secret-that-is-long-enough";
const now = 1_800_000_000_000;
const body = {
  requestId: "req-1",
  platform: "dailymotion" as const,
  url: "https://www.dailymotion.com/video/example",
  deadlineMs: 30_000
};
const result: YtDlpRunnerResponse = {
  platform: "dailymotion",
  sourceId: "example",
  title: "Example",
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
    headers: {}
  }]
};

function cli(): YtDlpCli {
  return { extract: async () => result, version: async () => "2026.08.19" };
}

describe("yt-dlp Runner", () => {
  it("requires a signed, platform-consistent internal request", async () => {
    const app = createYtDlpRunnerApp({ cli: cli(), hmacSecret: secret, now: () => now });
    try {
      expect((await app.inject({ method: "POST", url: "/internal/v1/extractions", payload: body })).statusCode)
        .toBe(401);
      const response = await app.inject({
        method: "POST",
        url: "/internal/v1/extractions",
        payload: body,
        headers: {
          "x-tikdd-timestamp": String(now),
          "x-tikdd-signature": signRunnerRequest(secret, String(now), body)
        }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ platform: "dailymotion", formats: [{ protocol: "https" }] });
      expect((await app.inject({
        method: "POST",
        url: "/internal/v1/extractions",
        payload: body,
        headers: {
          "x-tikdd-timestamp": String(now),
          "x-tikdd-signature": signRunnerRequest(secret, String(now), body)
        }
      })).statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });

  it("does not accept a platform spoof", async () => {
    const app = createYtDlpRunnerApp({ cli: cli(), hmacSecret: secret, now: () => now });
    try {
      const spoof = { ...body, platform: "youtube" as const, requestId: "req-2" };
      const response = await app.inject({
        method: "POST",
        url: "/internal/v1/extractions",
        payload: spoof,
        headers: {
          "x-tikdd-timestamp": String(now),
          "x-tikdd-signature": signRunnerRequest(secret, String(now), spoof)
        }
      });
      expect(response.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("prepares an artifact only through the signed bounded endpoint", async () => {
    const artifact = { platform: "dailymotion" as const, sourceId: "example", title: "Example", author: null,
      thumbnailUrl: null, durationSeconds: 30, isLive: false as const, extractor: "Dailymotion",
      artifact: { id: `yta_${"a".repeat(32)}`, container: "mp4" as const, mimeType: "video/mp4" as const,
        quality: "720p", width: 1280, height: 720, sizeBytes: 1024, sha256: "b".repeat(64),
        expiresAt: "2030-01-01T00:00:00.000Z" } };
    const artifactBody = { requestId: "artifact-1", platform: "dailymotion" as const,
      url: "https://www.dailymotion.com/video/example", deadlineMs: 175_000, maximumHeight: 720 };
    const app = createYtDlpRunnerApp({ cli: cli(), artifactPreparer: { prepare: async () => artifact },
      hmacSecret: secret, now: () => now });
    try {
      const response = await app.inject({ method: "POST", url: "/internal/v1/artifacts", payload: artifactBody,
        headers: { "x-tikdd-timestamp": String(now),
          "x-tikdd-signature": signRunnerRequest(secret, String(now), artifactBody) } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ artifact: { id: `yta_${"a".repeat(32)}`, sizeBytes: 1024 } });
      expect((await app.inject({ method: "POST", url: "/internal/v1/artifacts", payload: artifactBody,
        headers: { "x-tikdd-timestamp": String(now),
          "x-tikdd-signature": signRunnerRequest(secret, String(now), artifactBody) } })).statusCode).toBe(409);
    } finally { await app.close(); }
  });

  it("returns only the sanitized upstream failure code", async () => {
    const failing: YtDlpCli = {
      extract: async () => { throw new YtDlpProcessError("bot_challenge", "raw URL and token must not escape"); },
      version: async () => "2026.08.19"
    };
    const app = createYtDlpRunnerApp({ cli: failing, hmacSecret: secret, now: () => now });
    const request = { ...body, requestId: "challenge-1" };
    try {
      const response = await app.inject({ method: "POST", url: "/internal/v1/extractions", payload: request,
        headers: { "x-tikdd-timestamp": String(now), "x-tikdd-signature": signRunnerRequest(secret, String(now), request) } });
      expect(response.statusCode).toBe(422);
      expect(response.json()).toEqual({ error: { code: "bot_challenge" } });
      expect(response.body).not.toContain("raw URL");
    } finally { await app.close(); }
  });
});
