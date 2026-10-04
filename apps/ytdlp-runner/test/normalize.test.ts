import { describe, expect, it } from "vitest";
import { normalizeYtDlpOutput, reviewedYtDlpThumbnailUrl } from "../src/normalize";

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

  it("accepts reviewed Dailymotion thumbnail hosts and strips fragments", () => {
    expect(reviewedYtDlpThumbnailUrl(
      "dailymotion",
      "https://s1.dmcdn.net/v/fixture/x720.jpg?quality=preview#fragment"
    )).toBe("https://s1.dmcdn.net/v/fixture/x720.jpg?quality=preview");
    expect(normalizeYtDlpOutput("dailymotion", {
      id: "fixture",
      title: "Video",
      thumbnail: "https://s2.dmcdn.net/v/fixture/x720.jpg",
      formats: [{ format_id: "1", url: "https://media.example.test/video.mp4", vcodec: "h264", acodec: "aac" }]
    }).thumbnailUrl).toBe("https://s2.dmcdn.net/v/fixture/x720.jpg");
  });

  it("fails closed for unsafe Dailymotion thumbnails without affecting media", () => {
    for (const thumbnail of [
      "http://s1.dmcdn.net/v/fixture/x720.jpg",
      "https://user:pass@s1.dmcdn.net/v/fixture/x720.jpg",
      "https://s1.dmcdn.net:8443/v/fixture/x720.jpg",
      "https://evil-s1.dmcdn.net/v/fixture/x720.jpg",
      "https://s1.dmcdn.net.evil.test/v/fixture/x720.jpg"
    ]) expect(reviewedYtDlpThumbnailUrl("dailymotion", thumbnail)).toBeNull();
    const result = normalizeYtDlpOutput("dailymotion", {
      id: "fixture",
      title: "Video",
      thumbnail: "https://evil-s1.dmcdn.net/v/fixture/x720.jpg",
      formats: [{ format_id: "1", url: "https://media.example.test/video.mp4", vcodec: "h264", acodec: "aac" }]
    });
    expect(result.formats).toHaveLength(1);
    expect(result.thumbnailUrl).toBeNull();
  });
});
