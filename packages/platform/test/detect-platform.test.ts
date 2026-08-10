import { describe, expect, it } from "vitest";
import { detectPlatform, isSupportedPlatformUrl } from "../src/index";

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
