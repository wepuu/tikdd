import { describe, expect, it } from "vitest";
import type { YtDlpRunnerResponse } from "@tikdd/contracts";
import { createYtDlpRunnerApp } from "../src/app";
import { signRunnerRequest } from "../src/auth";
import type { YtDlpCli } from "../src/cli";

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
});
