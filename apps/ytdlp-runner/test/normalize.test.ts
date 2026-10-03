import { describe, expect, it } from "vitest";
import { normalizeYtDlpOutput } from "../src/normalize";

describe("yt-dlp output normalization", () => {
  it("keeps bounded media fields and strips cookie headers", () => {
    const result = normalizeYtDlpOutput("youtube", {
      id: "abc",
      title: "Video",
      extractor_key: "Youtube",
      thumbnail: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
      formats: [{
        format_id: "18",
        ext: "mp4",
        protocol: "https",
        url: "https://media.example.test/video.mp4",
        width: 640,
        height: 360,
        vcodec: "avc1",
        acodec: "mp4a",
        http_headers: { "User-Agent": "agent", Cookie: "secret", Referer: "https://youtube.com/" }
      }]
    });
    expect(result.thumbnailUrl).toContain("i.ytimg.com");
    expect(result.formats[0]?.headers).toEqual({ "User-Agent": "agent", Referer: "https://youtube.com/" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("rejects non-HTTPS and credentialed media URLs", () => {
    expect(() => normalizeYtDlpOutput("dailymotion", {
      id: "abc",
      title: "Video",
      formats: [{ format_id: "1", url: "http://media.example.test/video.mp4", vcodec: "h264", acodec: "aac" }]
    })).toThrow(/no safe media/i);
  });
});
