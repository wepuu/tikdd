import { describe, expect, it } from "vitest";
import { detectPlatform, isSupportedPlatformUrl, listPlatformDefinitions } from "../src/index";

const retainedYtDlpPlatforms = [
  ["https://9gag.com/gag/example", "9gag", "9gag.com"],
  ["https://artist.bandcamp.com/track/example", "bandcamp", "bandcamp.com"],
  ["https://www.bitchute.com/video/example", "bitchute", "bitchute.com"],
  ["https://example.blogspot.com/2026/08/video.html", "blogger", "blogspot.com"],
  ["https://www.buzzfeed.com/example/video", "buzzfeed", "buzzfeed.com"],
  ["https://www.espn.com/video/clip?id=1", "espn", "espn.com"],
  ["https://www.flickr.com/photos/example/1", "flickr", "flickr.com"],
  ["https://www.imdb.com/video/vi1", "imdb", "imdb.com"],
  ["https://imgur.com/example", "imgur", "imgur.com"],
  ["https://www.kickstarter.com/projects/example/project", "kickstarter", "kickstarter.com"],
  ["https://likee.video/example", "likee", "likee.video"],
  ["https://www.linkedin.com/posts/example", "linkedin", "linkedin.com"],
  ["https://www.loom.com/share/example", "loom", "loom.com"],
  ["https://medal.tv/games/example/clips/example", "medal", "medal.tv"],
  ["https://www.mixcloud.com/example/show", "mixcloud", "mixcloud.com"],
  ["https://ok.ru/video/1", "odnoklassniki", "ok.ru"],
  ["https://www.periscope.tv/example/1", "periscope", "periscope.tv"],
  ["https://puhutv.com/example", "puhutv", "puhutv.com"],
  ["https://rumble.com/example.html", "rumble", "rumble.com"],
  ["https://example.substack.com/p/video", "substack", "substack.com"],
  ["https://www.ted.com/talks/example", "ted", "ted.com"],
  ["https://t.me/example/1", "telegram", "t.me"]
] as const;

describe("detectPlatform", () => {
  it.each([
    ["https://www.tiktok.com/@creator/video/123?utm_source=share", "tiktok"],
    ["https://youtu.be/abcdefghijk?si=tracking", "youtube"],
    ["https://x.com/creator/status/123456", "x"],
    ["https://www.instagram.com/reel/example/", "instagram"],
    ["https://www.bilibili.com/video/BV1xx411c7mD", "bilibili"],
    ["https://vimeo.com/123456", "vimeo"],
    ["https://www.xiaohongshu.com/explore/example", "xiaohongshu"],
    ["https://xhslink.com/a/example", "xiaohongshu"],
    ["https://www.snapchat.com/spotlight/example", "snapchat"],
    ["https://v.ixigua.com/example", "xigua"],
    ["https://oasis.weibo.cn/v1/h5/share?sid=example", "oasis"]
  ] as const)("detects %s as %s", (url, platform) => {
    const result = detectPlatform(url);
    expect(result.platform).toBe(platform);
    expect(result.canonicalUrl).not.toContain("utm_");
    expect(result.canonicalUrl).not.toContain("?si=");
  });

  it("rejects host suffix spoofing", () => {
    expect(isSupportedPlatformUrl("https://youtube.com.attacker.example/watch?v=1")).toBe(false);
    expect(isSupportedPlatformUrl("https://x.com.attacker.example/user/status/1")).toBe(false);
  });

  it.each(retainedYtDlpPlatforms)("recognizes retained yt-dlp catalog URL %s as %s", (url, platform) => {
    expect(detectPlatform(url).platform).toBe(platform);
  });

  it.each(retainedYtDlpPlatforms)("rejects spoofed retained yt-dlp host for %s", (_url, _platform, hostname) => {
    expect(isSupportedPlatformUrl(`https://${hostname}.attacker.example/video/1`)).toBe(false);
  });

  it("keeps every retained yt-dlp addition planned and non-promotional", () => {
    const catalog = new Map(listPlatformDefinitions().map((platform) => [platform.id, platform]));
    for (const [, platform] of retainedYtDlpPlatforms) {
      expect(catalog.get(platform)).toMatchObject({ status: "planned", source: "yt-dlp" });
    }
  });

  it("rejects non-http schemes", () => {
    expect(isSupportedPlatformUrl("file:///etc/passwd")).toBe(false);
  });

  it.each([
    "https://user:password@x.com/example/status/123",
    "https://x.com:8443/example/status/123",
    "https://t.co/fixture-short-link"
  ])("rejects unsafe or unresolved X indirection before provider execution: %s", (url) => {
    expect(isSupportedPlatformUrl(url)).toBe(false);
  });

  it.each([
    ["https://x.com/example/status/123?s=20", "https://x.com/example/status/123"],
    [
      "https://www.tiktok.com/@creator/video/123?is_from_webapp=1&sender_device=pc",
      "https://www.tiktok.com/@creator/video/123"
    ]
  ])("removes platform share tracking from %s", (input, expected) => {
    expect(detectPlatform(input).canonicalUrl).toBe(expected);
  });

  it.each([
    ["https://twitter.com/example/status/123?s=20", "https://x.com/example/status/123"],
    ["https://mobile.twitter.com/example/status/123?utm_source=share", "https://x.com/example/status/123"],
    ["https://www.x.com/example/status/123#fragment", "https://x.com/example/status/123"],
    ["http://x.com/example/status/123/photo/1", "https://x.com/example/status/123/photo/1"]
  ])("canonicalizes X aliases and post variants: %s", (input, expected) => {
    expect(detectPlatform(input).canonicalUrl).toBe(expected);
  });
});
